import { Routes } from '@angular/router';
import { OrthagonalComponent } from '../features/orthagonal/orthagonal.component';
import { RaycasterComponent } from '../features/raycaster/raycaster.component';

export const routes: Routes = [
  {
    path: 'v2',
    component: RaycasterComponent,
  },
  {
    path: '**',
    component: OrthagonalComponent,
  },
];
