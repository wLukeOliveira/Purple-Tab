export type NavigationItem = 
  | 'home'
  | 'history'
  | 'comparison'
  | 'reports'
  | 'creation'
  | 'achievements'
  | 'settings';

export interface NavigationState {
  currentScreen: NavigationItem;
}
