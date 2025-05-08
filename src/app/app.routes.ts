import { Routes } from '@angular/router';
import { KimlabComponent } from '../features/kimlab/kimlab.component';
import { OrthagonalComponent } from '../features/raycasterv1/orthagonal.component';
import { RaycasterComponent } from '../features/raycasterv2/raycaster.component';

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
