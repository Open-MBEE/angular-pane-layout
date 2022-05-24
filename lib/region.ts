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
import { IPaneAnchor, IPaneOrientation, IPaneStyle } from './index';

export interface IRegion {
  top: number;
  right: number;
  bottom: number;
  left: number;
  height: number;
  width: number;

  clone(): IRegion;

  calculateSize(orientation: IPaneOrientation, target: number | string): number;

  consume(anchor, size): any;

  getInnerRegion(): IRegion;

  getSize(orientation: IPaneOrientation): number;

  getAvailableSize(orientation: IPaneOrientation): number;

  toString(): string;
}

export class Region implements IRegion {
  top: number;
  right: number;
  bottom: number;
  left: number;
  height: number;
  width: number;

  constructor(width?: number, height?: number, top?: number, right?: number, bottom?: number, left?: number) {
    this.width = width != null ? width : 0;
    this.height = height != null ? height : 0;
    this.top = top != null ? top : 0;
    this.right = right != null ? right : 0;
    this.bottom = bottom != null ? bottom : 0;
    this.left = left != null ? left : 0;
  }

  clone() {
    return new Region(this.width, this.height, this.top, this.right, this.bottom, this.left);
  }

  calculateSize(orientation: IPaneOrientation, target: number | string): number {
    let matches;
    let terms;

    if (target == null) {
      target = 0;
    }

    const total = this.getSize(orientation);
    const available = this.getAvailableSize(orientation);

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
      return this.calculateSize(orientation, terms.shift()) - this.calculateSize(orientation, terms.join('+'));
    }
    terms = target.split('+');
    if (terms.length > 1) {
      return this.calculateSize(orientation, terms.shift()) + this.calculateSize(orientation, terms.join('+'));
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

  consume(anchor: IPaneAnchor, size: number): IPaneStyle {
    let style;

    if (size == null) {
      size = 0;
    }

    switch (anchor) {
      case 'north':
        style = {
          top: '' + this.top + 'px',
          right: '' + this.right + 'px',
          bottom: 'auto',
          left: '' + this.left + 'px',
          height: '' + size + 'px',
          width: 'auto',
        };
        this.top += size;
        break;
      case 'east':
        style = {
          top: '' + this.top + 'px',
          right: '' + this.right + 'px',
          bottom: '' + this.bottom + 'px',
          left: 'auto',
          width: '' + size + 'px',
          height: 'auto',
        };
        this.right += size;
        break;
      case 'south':
        style = {
          top: 'auto',
          right: '' + this.right + 'px',
          bottom: '' + this.bottom + 'px',
          left: '' + this.left + 'px',
          height: '' + size + 'px',
          width: 'auto',
        };
        this.bottom += size;
        break;
      case 'west':
        style = {
          top: '' + this.top + 'px',
          right: 'auto',
          bottom: '' + this.bottom + 'px',
          left: '' + this.left + 'px',
          width: '' + size + 'px',
          height: 'auto',
        };
        this.left += size;
    }

    if (size === 0) {
      style.display = 'none';
    }

    return style;
  }

  getInnerRegion() {
    return new Region(this.width - this.right - this.left, this.height - this.top - this.bottom);
  }

  getSize(orientation) {
    switch (orientation) {
      case 'vertical':
        return this.height;
      case 'horizontal':
        return this.width;
    }
  }

  getAvailableSize(orientation): number {
    switch (orientation) {
      case 'vertical':
        return this.height - this.top - this.bottom;
      default:
        return this.width - this.right - this.left;
    }
  }

  toString() {
    return (
      '{' +
      this.top +
      ', ' +
      this.right +
      ', ' +
      this.bottom +
      ', ' +
      this.left +
      '}, {' +
      this.width +
      ', ' +
      this.height +
      '}'
    );
  }
}
