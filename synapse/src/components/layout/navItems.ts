import { BookOpenText, Brain, GitMerge, LayoutDashboard, Layers, Lightbulb, Settings2, type LucideIcon } from 'lucide-react';
import type { View } from '../../types';

export interface NavItem {
  view: View;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Second key of the "g then x" chord. */
  chord: string;
  principle?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, chord: 'd' },
  { view: 'review', label: 'Daily Deck', short: 'Deck', icon: Layers, chord: 'r', principle: 'Spaced · Interleaved' },
  { view: 'gym', label: 'Retrieval Gym', short: 'Gym', icon: Brain, chord: 'b', principle: 'Blurting' },
  { view: 'feynman', label: 'Feynman Studio', short: 'Feynman', icon: Lightbulb, chord: 'f', principle: 'Simplicity check' },
  { view: 'synthesis', label: 'Synthesis Bridge', short: 'Bridge', icon: GitMerge, chord: 'e', principle: 'Elaboration' },
  { view: 'topics', label: 'Topics & Models', short: 'Topics', icon: BookOpenText, chord: 't' },
  { view: 'settings', label: 'Settings', short: 'Settings', icon: Settings2, chord: 's' }
];
