/*
 * Copyright (c) <2021>, California Institute of Technology ("Caltech").
 *  U.S. Government sponsorship acknowledged.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

import * as angular from 'angular';
import { handleChange, calculateSize } from '../utils/utils';
import { ngPane } from '../ng-pane';
import { IPane, IPaneOrientation, IPaneScope } from '../index';

const NgPaneResizer = {
  template: `
    <ng-pane-toggle ng-if="!$ctrl.ngPane.noToggle" class="ng-pane-toggle" ng-click="$ctrl.ngPane.toggle()"></ng-pane-toggle>    
`,
  transclude: true,
  bindings: {
    paneDragged: '<',
    paneOrientation: '<',
  },
  require: {
    ngPane: '^',
  },
  controller: class NgPaneResizerController implements angular.IComponentController {
    private ngPane: IPane;
    private paneOrientation: IPaneOrientation;
    private paneDragged: boolean;

    static $inject = ['$window', '$scope', '$element', '$attrs'];

    constructor(
      private $window: angular.IWindowService,
      private $scope: IPaneScope,
      private $element: JQuery<HTMLElement>,
      private $attrs: angular.IAttributes,
    ) {}

    $onChanges(onChangesObj: angular.IOnChangesObject) {
      handleChange(onChangesObj, 'paneOrientation', (orientation) => {
        this.$element.removeClass('vertical');
        this.$element.removeClass('horizontal');

        switch (orientation) {
          case 'vertical':
            return this.$element.addClass('vertical');
          case 'horizontal':
            return this.$element.addClass('horizontal');
        }
      });
    }

    throttle(delay, fn) {
      let throttled = false;

      return function () {
        if (throttled) {
          return;
        }
        throttled = true;

        setTimeout(() => {
          return (throttled = false);
        }, delay);

        return fn.call.apply(fn, [this].concat([].slice.call(arguments)));
      };
    }
    $postLink() {
      const el = this.$element[0];

      const clickRadius = 5;
      const clickTime = 300;

      el.addEventListener('mousedown', (e?: MouseEvent) => {
        if (e && e.button !== 0) {
          return;
        }

        const anchor = this.ngPane.anchor;
        let coord;
        if (anchor === 'north' || anchor === 'south') {
          coord = 'screenY';
        } else if (anchor === 'west' || anchor === 'east') {
          coord = 'screenX';
        }

        let scale: number;
        if (anchor === 'north' || anchor === 'west') {
          scale = 1;
        } else if (anchor === 'south' || anchor === 'east') {
          scale = -1;
        }

        const startPos = {
          x: e.screenX,
          y: e.screenY,
        };
        const startCoord = e[coord];
        const startSize = this.ngPane.size;
        const startTime = Date.now();

        // pane.onHandleDown();

        el.onselectstart = () => {
          return false;
        };
        el.style.userSelect = 'none';

        // Null out the event to re-use e and prevent memory leaks
        // e.setCapture();
        e.preventDefault();
        e = null;

        const handleMouseMove = (event: MouseEvent) => {
          if (!event) {
            return;
          }
          this.paneDragged = true; // Fix for dragging on toggle

          this.ngPane.$onStartResize();

          // Inside Angular's digest, determine the ideal size of the element
          // according to movements then determine if those movements have been
          // constrained by boundaries, other panes or min/max clauses
          // this.$scope.$apply(() => {

          const size = calculateSize(this.paneOrientation, this.ngPane.$region, startSize);
          const targetSize = size + scale * (event[coord] - startCoord);
          this.ngPane.resize(targetSize);
          // });

          // Null out the event in case of memory leaks
          // e.setCapture();
          event.preventDefault();
          return (event = null);
        };

        const handleMouseUp = (event: MouseEvent) => {
          if (!event) {
            return;
          }
          const displacementSq = Math.pow(event.screenX - startPos.x, 2) + Math.pow(event.screenY - startPos.y, 2);
          const timeElapsed = Date.now() - startTime;

          this.$window.removeEventListener('mousemove', handleMouseMoveThrottled, true);
          this.$window.removeEventListener('mouseup', handleMouseUp, true);

          const cleanup = (cleanEvent: MouseEvent) => {
            if (!cleanEvent) {
              return;
            }
            this.ngPane.$onStopResize();

            // Null out the event in case of memory leaks
            // e.releaseCapture();
            cleanEvent.preventDefault();
            return (cleanEvent = null);
          };

          if (displacementSq <= Math.pow(clickRadius, 2) && timeElapsed <= clickTime) {
            cleanup(event);
            return;
          }

          // In case the mouse is released at the end of a throttle period
          handleMouseMove(event);

          return cleanup(event);
        };

        // Prevent the reflow logic from happening too often
        const handleMouseMoveThrottled = this.throttle(10, handleMouseMove);

        this.$window.addEventListener('mouseup', handleMouseUp, true);
        return this.$window.addEventListener('mousemove', handleMouseMoveThrottled, true);
      });
    }
  },
};

ngPane.component('ngPaneResizer', NgPaneResizer);
