import { Routes } from '@angular/router';
import { OrthagonalComponent } from '../features/orthagonal/orthagonal.component';

export const routes: Routes = [
  {
    path: '**',
    component: OrthagonalComponent,
  },
];
