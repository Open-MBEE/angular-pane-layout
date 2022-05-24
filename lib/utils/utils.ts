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

import { IPaneAnchor, IPaneOrientation, IPaneStyle, IRegion } from '../index';
import * as angular from 'angular';

/**
 * @name onChangesCallback
 * @description This function type defines the expected format for a callback added to the {@link handleChange}
 * helper function.
 * @example
 *      myCallback: onChangesCallback = (newVal, oldVal, firstChange) => {
 *          if (newVal != oldVal && !firstChange) {
 *              doSomething();
 *          }
 *
 *      }
 *
 */
export type onChangesCallback = (newVal?: any, oldVal?: any, firstChange?: boolean) => any;

/**
 * @name change.utils#handleChange:
 * @description This function is a pseudo replacement for most of the boilerplate needed to replace $scope.watch type behavior with
 * angular 1.5 components.
 * @example
 *  class ComponentController {
 *      constructor() {...}
 *      $onChanges(onChangesObj) {
 *          handleChange(onChangesObj,'watchedBinding',myCallback)
 *      }
 *
 *      myCallback: onChangesCallback = (newVal, oldVal) => {
 *          if newVal != oldVal
 *              doSomething();
 *      }
 *  }
 * @param {angular.IOnChangesObject} changesObj
 * @param {string} watch
 * @param {onChangesCallback} callback
 * @param {boolean} ignoreFirst -
 * @returns {any}
 */
export function handleChange(
  changesObj: angular.IOnChangesObject,
  watch: string,
  callback: onChangesCallback,
  ignoreFirst?: boolean,
): any {
  if (watch === '') {
    return callback();
  } else if (changesObj[watch]) {
    if (ignoreFirst && changesObj[watch].isFirstChange()) {
      return;
    }
    const newVal = changesObj[watch].currentValue;
    const oldVal = changesObj[watch].previousValue;
    const firstChange = changesObj[watch].isFirstChange();
    return callback(newVal, oldVal, firstChange);
  }
  return;
}

export function calculateSize(orientation: IPaneOrientation, region: IRegion, target: number | string): number {
  let matches;
  let terms;

  if (target == null) {
    target = 0;
  }

  const total = region.getSize(orientation);
  const available = region.getAvailableSize(orientation);

  if (angular.isNumber(target)) {
    if (target >= 1) {
      return Math.round(target);
    }
    if (target >= 0) {
      return Math.round(target * total);
    }
    return 0;
  }

  // Kill whitespace
  target = target.replace(/\s+/gm, '');

  // Allow for complex sizes, e.g.: 50% - 4px
  terms = target.split('-');
  if (terms.length > 1) {
    return calculateSize(orientation, region, terms.shift()) - calculateSize(orientation, region, terms.join('+'));
  }
  terms = target.split('+');
  if (terms.length > 1) {
    return calculateSize(orientation, region, terms.shift()) + calculateSize(orientation, region, terms.join('+'));
  }
  matches = target.match(/^(\d+)(?:px)?$/);
  if (matches != null) {
    return parseInt(matches[1], 10);
  }
  matches = target.match(/^(\d+(?:\.\d+)?)&$/);
  if (matches != null) {
    return Math.round((available * parseFloat(matches[1])) / 100);
  }
  matches = target.match(/^(\d+(?:\.\d+)?)%$/);
  if (matches != null) {
    return Math.round((total * parseFloat(matches[1])) / 100);
  }

  throw new Error('Unsupported size: ' + target);
}

export const getOrientation = (anchor: IPaneAnchor): 'vertical' | 'horizontal' | undefined => {
  switch (anchor) {
    case 'north':
    case 'south':
      return 'vertical';
    case 'east':
    case 'west':
      return 'horizontal';
  }
};

export const getScrollerStyle = (anchor: IPaneAnchor, size: number): IPaneStyle => {
  const style: IPaneStyle = {
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
    height: 'auto',
    width: 'auto',
  };

  if (size) {
    switch (anchor) {
      case 'north':
        style.bottom = 'auto';
        style.height = '' + size + 'px';
        break;
      case 'east':
        style.left = 'auto';
        style.width = '' + size + 'px';
        break;
      case 'south':
        style.top = 'auto';
        style.height = '' + size + 'px';
        break;
      case 'west':
        style.right = 'auto';
        style.width = '' + size + 'px';
    }
  }

  return style;
};

export const getHandleStyle = (anchor: IPaneAnchor, region: IRegion, handleSize: number): IPaneStyle => {
  switch (anchor) {
    case 'north':
      return {
        height: region.calculateSize('vertical', handleSize) + 'px',
        right: '0',
        left: '0',
        bottom: '0',
      };
    case 'south':
      return {
        height: region.calculateSize('vertical', handleSize) + 'px',
        right: '0',
        left: '0',
        top: '0',
      };
    case 'east':
      return {
        width: region.calculateSize('horizontal', handleSize) + 'px',
        top: '0',
        bottom: '0',
        left: '0',
      };
    case 'west':
      return {
        width: region.calculateSize('horizontal', handleSize) + 'px',
        top: '0',
        bottom: '0',
        right: '0',
      };
    default:
      return {
        height: region.calculateSize('vertical', handleSize) + 'px',
        right: '0',
        left: '0',
        bottom: '0',
      };
  }
};

export const generateSerialId = (() => {
  let counter = 0;

  return () => {
    return {
      counter: counter++,
      peek: () => {
        return counter;
      },
    };
  };
})();
