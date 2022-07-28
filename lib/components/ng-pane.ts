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
import * as $ from 'jquery';
import Rx from 'rx-lite';
import { TransitionService } from '@uirouter/angularjs';
import { IPaneManagerService } from '../PaneManagerService';
import { ngPane } from '../ng-pane';
import { IRegion } from '../region';
import { generateSerialId, getHandleStyle, getOrientation, getScrollerStyle, handleChange } from '../utils/utils';
import { Region } from '../region';

export interface IPaneOptions {
  anchor?: string;
  targetSize?: string;
  size?: string;
  min?: number;
  max?: number;
  handle?: string | IPaneHandle;
  order?: number;
  noToggle?: boolean;
  closed?: boolean;
}

export interface IPane extends angular.IComponentController {
  anchor: IPaneAnchor;
  paneId: string;
  size: string;
  min: number;
  max: number;
  offsetTop: number;
  offsetRight: number;
  offsetBottom: number;
  offsetLeft: number;
  handle: string | IPaneHandle;
  closed: boolean;
  order: number;
  noToggle: boolean;
  noScroll: boolean;
  scrollApi;
  id: string;
  parentCtrl: angular.IComponentController;
  parentCtrlAs: string;

  parentPane: IPane;
  $toggled: Rx.ISubject<string>;
  $parent: IPaneScope;
  $region: IRegion;
  paneDragged: boolean;
  orientation: 'vertical' | 'horizontal' | undefined;

  setupScrollEvent(elementWithScrollbar, elementInsideScrollbar, elementScope): void;

  getOptions(): IPaneOptions;

  setOptions(options: IPaneOptions): boolean;

  setAnchor(anchor: 'north' | 'south' | 'east' | 'west'): boolean;

  setTargetSize(targetSize: string): boolean;

  setMinSize(min: number): boolean;

  setMaxSize(max: number): boolean;

  setOrder(order: number): boolean;

  setNoToggle(noToggle: boolean): boolean;

  setHandleSize(handleSize: string | IPaneHandle): boolean;

  addChild(child: IPane): boolean;

  getOrientation(): string;

  onHandleDown(): JQuery<HTMLElement>;

  onHandleUp(): any;

  removeChild(child: IPane): boolean;

  reflow(region?: IRegion): void;

  reflowChildren(region: IRegion): void;

  resize(size: number): JQuery<HTMLElement>;

  toggle(open?: boolean): boolean;
}

/**
 * @internal Use for internal development only
 */
export interface IPaneInternal extends IPane {
  $onStartResize(): void;
  $onStopResize(): void;
}

export interface IPaneScope extends angular.IScope {
  $pane?: IPane;
  $ctrl?: angular.IComponentController;
  $parent: IPaneScope;
}

export interface IPaneStyle extends JQLiteCssProperties {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  height?: string;
  width?: string;
}

export interface IPaneHandle {
  open?: string;
  closed?: string;
}

export interface IPaneScrollApi {
  isScrollVisible?(): boolean;
  frequency?: number;
  throttleRate?: number;
  threshold?: number;
  notifyOnScroll?(): boolean;
}

export type IPaneAnchor = 'north' | 'south' | 'east' | 'west';
export type IPaneOrientation = 'vertical' | 'horizontal';

class PaneController implements IPaneInternal {
  // Injected
  readonly $evalAsync;

  // Bindings
  public anchor: IPaneAnchor;
  paneId: string;
  size: string;
  min: number;
  max: number;
  offsetTop: number;
  offsetRight: number;
  offsetBottom: number;
  offsetLeft: number;
  handle: string | IPaneHandle;
  closed: boolean;
  order: number;
  noToggle: boolean;
  noScroll: boolean;
  scrollApi;
  id: string;
  parentCtrl: angular.IComponentController;
  parentCtrlAs: string;

  // Locals
  parentPane: IPane;
  children: IPane[];
  $reflowScheduled: boolean;
  $directiveScope: IPaneScope;
  $transcludeScope: IPaneScope;
  $toggled: Rx.Subject<string>;

  $containerEl: JQuery<HTMLElement>;
  $overlayEl: JQuery<HTMLElement>;
  $handleEl: JQuery<HTMLElement>;
  $transcludeEl: JQuery<HTMLElement>;
  targetSize: string;
  $parent: IPaneScope;
  defaultHandleSize: string = '13';
  handleSizeOpen: string;
  handleSizeClosed: string;
  $region: IRegion;
  paneDragged: boolean;
  orientation: 'vertical' | 'horizontal' | undefined;

  static $inject = [
    '$window',
    '$scope',
    '$compile',
    '$timeout',
    '$transclude',
    '$interval',
    '$element',
    '$attrs',
    '$transitions',
    '$paneManager',
  ];

  constructor(
    private $window,
    private $scope: IPaneScope,
    private $compile: angular.ICompileService,
    private $timeout: angular.ITimeoutService,
    private $transclude: angular.ITranscludeFunction,
    private $interval: angular.IIntervalService,
    private $element: JQuery<HTMLElement>,
    private $attrs: angular.IAttributes,
    private $transitions: TransitionService,
    private $paneManager: IPaneManagerService,
  ) {
    this.$evalAsync = this.$scope.$root.$evalAsync;
  }

  $onInit() {
    this.children = [];
    this.closed = this.closed ? this.closed : false;
    this.noToggle = false;
    this.max = Number.MAX_VALUE;
    this.min = 0;
    this.targetSize = this.size;
    this.$toggled = new Rx.Subject<string>();

    const serialId: { counter: number; peek: () => number } = generateSerialId();

    if (this.order == null) {
      this.order = serialId.peek();
    }
    if (!this.paneId || this.paneId === '') {
      this.id = this.$paneManager.newId(this);
    } else {
      this.id = this.paneId;
    }
  }

  $postLink() {
    this.$directiveScope = this.$scope.$parent.$new();

    this.$directiveScope.$pane = this;
    //
    const $transcludeScope = this.$scope.$new();
    // Compatibility with Previous Directive
    const $transcludeEl = $('<div></div>');
    const classList = $(this.$element).get(0).classList;
    classList.remove(...['ng-scope', 'ng-isolate-scope']);
    $transcludeEl.addClass(classList.value);

    const attributes = $(this.$element)[0].attributes;
    const attrOb = {};
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes.item(i);
      if (attr) {
        attrOb[attr.name] = attr.value;
      }
    }

    $transcludeEl.attr(attrOb);

    this.$element.addClass('ng-pane');
    this.$element.addClass('pane-' + this.id);

    this.$transcludeScope = $transcludeScope;

    if (this.parentCtrl) {
      let ctrlAs = '$ctrl';
      if (this.parentCtrlAs) {
        ctrlAs = this.parentCtrlAs;
      }
      this.$transcludeScope[ctrlAs] = this.parentCtrl;
    }

    this.$transclude($transcludeScope, ($transcludeClone) => {
      if (!$transcludeClone) {
        return;
      }
      if (!this.noScroll) {
        $transcludeClone.addClass('ng-pane-scroller');
        if (this.scrollApi) {
          this.setupScrollEvent(this.$element[0], $transcludeClone, this.$scope);
        }
      }
      $transcludeEl.append($transcludeClone);
      this.$element.append($transcludeEl);

      this.$containerEl = this.$element;
      this.$overlayEl = this.$element.children().eq(0);
      this.$handleEl = this.$element.children().eq(1);
      this.$transcludeEl = this.$element.children().eq(2);

      this.$window.addEventListener('resize', (e) => {
        e.stopPropagation();
        return this.$scheduleReflow();
      });

      this.$transitions.onSuccess({}, () => {
        return this.$scheduleReflow();
      });

      // this.$directiveScope.$emit("ng-pane-attach", this);
      if (this.parentPane) this.parentPane.addChild(this);
      // console.log("Parent: " + this.parentPane.id + " Child: " + this.id);
      // return this.$directiveScope.$on("$destroy", () => {
      //     return this.$directiveScope.$emit("ng-pane-detach", this);
      // });
    });
  }

  $onChanges(onChangesObj: angular.IOnChangesObject) {
    if (!this) {
      return;
    }
    handleChange(onChangesObj, 'anchor', this.setAnchor, true);

    handleChange(onChangesObj, 'size', this.setTargetSize, true);

    handleChange(
      onChangesObj,
      'closed',
      () => {
        this.toggle(!this.closed);
      },
      true,
    );

    handleChange(
      onChangesObj,
      'min',
      () => {
        this.setMinSize(this.min != null ? this.min : 0);
      },
      true,
    );

    handleChange(
      onChangesObj,
      'max',
      () => {
        this.setMaxSize(this.max != null ? this.max : Number.MAX_VALUE);
      },
      true,
    );

    handleChange(
      onChangesObj,
      'order',
      () => {
        this.setOrder(this.order);
      },
      true,
    );

    handleChange(
      onChangesObj,
      'noToggle',
      () => {
        this.setNoToggle(!!this.noToggle);
      },
      true,
    );

    handleChange(
      onChangesObj,
      'paneId',
      (newVal, oldVal) => {
        if (oldVal) {
          this.$paneManager.remove(oldVal);
        }
        this.$paneManager.set(newVal, this);
        this.id = newVal;
      },
      true,
    );

    handleChange(
      onChangesObj,
      'handle',
      () => {
        this.setHandleSize(this.handle);
      },
      false,
    );
  }

  $onDestroy() {
    this.$toggled.dispose();
    if (this.parentPane) {
      this.parentPane.removeChild(this);
    }
  }

  public setupScrollEvent = (elementWithScrollbar, elementInsideScrollbar, elementScope) => {
    // This assignment gives access to this method to the client of the library

    const thresholdFromScrollbarAndBottom = elementScope.scrollApi.threshold || 2000;
    const scrollThrottleRate = elementScope.scrollApi.throttleRate || 500;
    const frequency = elementScope.scrollApi.frequency || 100;
    let waiting = false;
    let intervalHandler;

    const _scrollHandler = () => {
      if (waiting) {
        return;
      }
      waiting = true;
      // scrolling happens very fast. buffer it using scrollThrottleRate
      this.$timeout(() => {
        intervalHandler = this.$interval(() => {
          const totalHeight = elementInsideScrollbar.prop('scrollHeight');
          const hiddenContentHeight = totalHeight - elementInsideScrollbar.height();
          if (_isScrollbarAlmostAtTheBottom(hiddenContentHeight)) {
            const stopListen = this.scrollApi.notifyOnScroll();
            if (stopListen) {
              elementWithScrollbar.removeEventListener('scroll', _scrollHandler, true);
              this.$interval.cancel(intervalHandler);
            }
          } else {
            waiting = false;
            this.$interval.cancel(intervalHandler);
          }
        }, frequency);
      }, scrollThrottleRate);
    };

    const _isScrollbarVisible = () => {
      return elementInsideScrollbar.prop('scrollHeight') > elementInsideScrollbar.height();
    };

    const _isScrollbarAlmostAtTheBottom = (hiddenContentHeight) => {
      return hiddenContentHeight - elementInsideScrollbar.scrollTop() <= thresholdFromScrollbarAndBottom;
    };

    elementScope.scrollApi.isScrollVisible = _isScrollbarVisible;
    elementInsideScrollbar.removeAttr('pane-scroll-api');
    elementWithScrollbar.addEventListener('scroll', _scrollHandler, true);
  };

  $scheduleReflow(): boolean {
    if (this.parentPane && this.parentPane.paneId && this.parentPane.paneId !== this.paneId) {
      // console.log("Parent:" + this.parentPane.paneId, "Child:" + this.paneId);
      return this.parentPane.$scheduleReflow();
    } else if (!this.$reflowScheduled) {
      this.$reflowScheduled = true;

      return this.$evalAsync(() => {
        if (this.$reflowScheduled) {
          this.reflow();
        }

        return (this.$reflowScheduled = false);
      });
    }
  }

  $onStartResize() {
    if (this.parentPane) {
      this.parentPane.$containerEl.addClass('ng-pane-resizing');
    } else {
      this.$containerEl.addClass('ng-pane-resizing');
    }
  }
  $onStopResize() {
    if (this.parentPane) {
      this.parentPane.$containerEl.removeClass('ng-pane-resizing');
    } else {
      this.$containerEl.removeClass('ng-pane-resizing');
    }
  }

  public getOptions = (): IPaneOptions => {
    return {
      anchor: this.anchor,
      targetSize: this.targetSize,
      size: this.size,
      min: this.min,
      max: this.max,
      order: this.order || 0,
      handle: {
        open: this.handleSizeOpen || this.defaultHandleSize,
        closed: this.handleSizeClosed || this.defaultHandleSize,
      },
      noToggle: !!this.noToggle,
      closed: this.closed,
    };
  };

  public setOptions = (options?: IPaneOptions) => {
    let result: boolean = true;
    if (options) {
      if (options.anchor != null) {
        result = this.setAnchor(options.anchor);
      }
      if (options.size != null) {
        result = result && this.setTargetSize(options.size);
      }
      if (options.min != null) {
        result = result && this.setMinSize(options.min);
      }
      if (options.max != null) {
        result = result && this.setMaxSize(options.max);
      }
      if (options.handle != null) {
        result = result && this.setHandleSize(options.handle);
      }
      if (options.order != null) {
        result = result && this.setOrder(options.order);
      }
      if (options.noToggle != null) {
        result = result && this.setNoToggle(options.noToggle);
      }
      if (options.closed != null) {
        result = result && this.toggle(!options.closed);
      }
    }
    return result;
  };

  public setAnchor = (anchor) => {
    this.anchor = anchor;
    this.orientation = this.getOrientation();

    return this.$scheduleReflow();
  };

  public setTargetSize = (targetSize: string) => {
    this.targetSize = targetSize;

    return this.$scheduleReflow();
  };

  public setMinSize = (min) => {
    this.min = min;

    return this.$scheduleReflow();
  };

  public setMaxSize = (max) => {
    this.max = max;

    return this.$scheduleReflow();
  };

  public setOrder = (order) => {
    this.order = order;

    return this.$scheduleReflow();
  };

  public setNoToggle = (noToggle) => {
    this.noToggle = noToggle;

    return this.$scheduleReflow();
  };

  public setHandleSize = (handleSize: string | IPaneHandle): boolean => {
    if (handleSize && typeof handleSize === 'string') {
      this.handleSizeOpen = handleSize;
      this.handleSizeClosed = handleSize;
    } else if (handleSize && ((handleSize as IPaneHandle).open || (handleSize as IPaneHandle).closed)) {
      handleSize = handleSize as IPaneHandle;
      this.handleSizeOpen = handleSize.open || '0';
      this.handleSizeClosed = handleSize.closed || '0';
    } else {
      this.handleSizeOpen = this.handleSizeClosed = this.defaultHandleSize;
    }

    return this.$scheduleReflow();
  };

  public addChild = (child) => {
    child.parent = this;
    this.children.push(child);

    if (this.children.length) {
      this.$containerEl.addClass('ng-pane-parent');
    }

    return this.$scheduleReflow();
  };

  public getOrientation = () => {
    return getOrientation(this.anchor);
  };

  public onHandleDown = () => {
    return this.$containerEl.addClass('active');
  };

  public onHandleUp = () => {
    this.$containerEl.removeClass('active');

    return this.$scheduleReflow();
  };

  public removeChild = (child: IPane) => {
    const idx = this.children.indexOf(child);

    if (!(0 > idx)) {
      this.children.splice(idx, 1);
    }

    if (!this.children.length) {
      this.$containerEl.removeClass('ng-pane-parent');
    }

    return this.$scheduleReflow();
  };

  public reflow = (region?: IRegion) => {
    const width = this.$containerEl[0].offsetWidth;
    const height = this.$containerEl[0].offsetHeight;

    if (!region) {
      region = new Region(width, height, this.offsetTop, this.offsetRight, this.offsetBottom, this.offsetLeft);
    }

    const _ref = this.anchor;
    if (_ref === 'north' || _ref === 'east' || _ref === 'south' || _ref === 'west') {
      this.$containerEl.removeClass('ng-pane-orientation-vertical');
      this.$containerEl.removeClass('ng-pane-orientation-horizontal');

      const orientation = getOrientation(this.anchor);

      this.$containerEl.addClass('ng-pane-orientation-' + orientation);

      const handleSize = region.calculateSize(
        orientation,
        (!this.closed && this.handleSizeOpen) || this.handleSizeClosed,
      );

      let size = handleSize;
      if (!this.closed) {
        size = region.calculateSize(orientation, (!this.closed && this.targetSize) || handleSize);

        size = Math.min(size, region.calculateSize(orientation, this.max));
        size = Math.max(size, region.calculateSize(orientation, this.min));
        size = Math.min(size, region.getAvailableSize(orientation));
        size = Math.max(size, handleSize);
      }

      this.size = size.toString(10);

      const styleContainer = region.consume(this.anchor, size);
      const styleScroller = getScrollerStyle(this.anchor, size - handleSize);
      const styleHandle = getHandleStyle(this.anchor, region, handleSize);

      this.$containerEl.attr('style', '').css(styleContainer);
      this.$overlayEl.attr('style', '').css(styleScroller);
      this.$handleEl.attr('style', '').css(styleHandle);
      this.$transcludeEl.attr('style', '').css(styleScroller);
    } else {
      this.$containerEl.css({
        top: region.top + 'px',
        right: region.right + 'px',
        bottom: region.bottom + 'px',
        left: region.left + 'px',
        width: 'auto',
        height: 'auto',
      });
    }

    this.$region = region.clone();
    this.reflowChildren(region.getInnerRegion());
  };

  public reflowChildren = (region: Region) => {
    if (!region) {
      region = this.$region;
    }

    this.children.sort((a, b) => {
      return a.order - b.order;
    });

    for (const childCtrl of this.children) {
      if (childCtrl) {
        childCtrl.reflow(region);
      }
    }
  };

  public resize = (size) => {
    if (size == null) {
      size = this.targetSize;
    }

    this.targetSize = size;
    if (this.parentPane != null) {
      this.parentPane.reflowChildren(this.parentPane.$region.getInnerRegion());
    }

    if (size !== this.size) {
      return this.$containerEl.addClass('ng-pane-constrained');
    } else {
      return this.$containerEl.removeClass('ng-pane-constrained');
    }
  };

  public toggle = (open?: boolean): boolean => {
    // Fix for dragging on toggle
    if (this.paneDragged) {
      this.paneDragged = false;
    }

    if (open == null) {
      open = !!this.closed;
    }

    this.closed = !open;
    if (this.paneId) {
      this.$toggled.onNext(this.paneId + '-pane-toggled');
    }

    const reflow = (): boolean => {
      if (this.parentPane) {
        return this.parentPane.$scheduleReflow();
      } else {
        return this.$scheduleReflow();
      }
    };

    if (this.closed) {
      this.$containerEl.addClass('ng-pane-closed');
    } else {
      this.$containerEl.removeClass('ng-pane-closed');
    }

    return reflow();
  };
}

const NgPaneComponent = {
  require: {
    parentPane: '?^^ngPane',
  },
  bindings: {
    anchor: '@paneAnchor',
    paneId: '@paneId',
    size: '@paneSize',
    min: '@paneMin',
    max: '@paneMax',
    offsetTop: '@paneTop',
    offsetRight: '@paneRight',
    offsetBottom: '@paneBottom',
    offsetLeft: '@paneLeft',
    handle: '@paneHandle',
    closed: '@paneClosed',
    order: '@paneOrder',
    noToggle: '@paneNoToggle',
    noScroll: '@paneNoScroll',
    scrollApi: '<paneScrollApi',
    parentCtrl: '<',
    parentCtrlAs: '<',
  },
  template: `
    <div class="ng-pane-overlay"></div>
    <ng-pane-resizer class="ng-pane-handle"  pane-dragged="$pane.paneDragged" pane-orientation="$pane.orientation"></ng-pane-resizer>
`,
  controllerAs: '$pane',
  transclude: true,
  controller: PaneController,
};

ngPane.component('ngPane', NgPaneComponent);
