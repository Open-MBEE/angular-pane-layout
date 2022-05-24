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

import { ngPane } from './ng-pane';

import { IPane } from './index';

export interface IPaneManagerService {
  get(paneId: string): IPane;
  set(paneId: string, pane: IPane): boolean;
  remove(paneId: string): boolean;
  newId(pane: IPane): string;
}

class PaneManagerService implements IPaneManagerService {
  private counter = 0;
  private panes = {};

  get(paneId) {
    return this.panes[paneId];
  }
  set(paneId, pane) {
    return (this.panes[paneId] = pane);
  }
  remove(paneId) {
    return delete this.panes[paneId];
  }
  newId(pane) {
    this.counter++;
    const id = this.counter.toString();
    this.set(id, pane);
    return id;
  }
}

ngPane.service('$paneManager', PaneManagerService);
