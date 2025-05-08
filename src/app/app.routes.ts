import { Routes } from '@angular/router';
import { KimlabComponent } from '../features/kimlab/kimlab.component';
import { OrthagonalComponent } from '../features/orthagonal/orthagonal.component';
import { RaycasterComponent } from '../features/raycaster/raycaster.component';

export const routes: Routes = [
  {
    path: 'v1',
    component: OrthagonalComponent,
  },
  {
    path: 'kimlab',
    component: KimlabComponent,
  },
  {
    path: '**',
    component: RaycasterComponent,
  },
];
