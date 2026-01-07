import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/countdown/countdown').then((m) => m.CountdownComponent),
  },
  {
    path: 'remote',
    loadComponent: () => import('./components/remote/remote').then((m) => m.RemoteComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

