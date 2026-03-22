import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, input } from '@angular/core';
import { cx } from '../../utils/ckassnames';

type ButtonProps = {
  impact: 'bold' | 'light' | 'none';
  size: 'small' | 'medium' | 'large';
  shape: 'square' | 'rounded' | 'pill';
  tone: 'primary' | 'danger' | 'success' | 'warning' | 'info' | 'light';
  shadow: 'none' | 'small' | 'medium' | 'large';
  type: 'button' | 'submit' | 'reset';
};

@Component({
  selector: 'app-button',
  imports: [CommonModule],
  templateUrl: './button.component.html',
  styleUrl: './button.component.css',
})
export class ButtonComponent implements OnInit {
  impact = input<ButtonProps['impact']>('none');
  size = input<ButtonProps['size']>('medium');
  shape = input<ButtonProps['shape']>('rounded');
  tone = input<ButtonProps['tone']>('primary');
  shadow = input<ButtonProps['shadow']>('none');
  type = input<String>('submit');
  full = input(false, {
    transform: (value: boolean | string) => (typeof value === 'string' ? value === '' : value),
  });
  disabled = input(false, {
    transform: (value: boolean | string) => (typeof value === 'string' ? value === '' : value),
  });

  @Output() buttonClick = new EventEmitter<void>();

  public classes: string = '';

  baseClasses =
    'flex items-center justify-center border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none';

  impactClasses: Record<ButtonProps['tone'], Record<ButtonProps['impact'], string>> = {
    primary: {
      bold: 'border-primary bg-primary text-primary-foreground hover:border-primary/90 hover:bg-primary/90 focus-visible:ring-primary',
      light: 'border-primary/25 bg-primary/15 text-primary hover:border-primary/35 hover:bg-primary/25 focus-visible:ring-primary',
      none: 'border-transparent bg-transparent text-primary hover:bg-primary/10 focus-visible:ring-primary',
    },
    danger: {
      bold: 'border-destructive bg-destructive text-white hover:border-destructive/90 hover:bg-destructive/90 focus-visible:ring-destructive',
      light: 'border-destructive/25 bg-destructive/15 text-destructive hover:border-destructive/35 hover:bg-destructive/25 focus-visible:ring-destructive',
      none: 'border-transparent bg-transparent text-destructive hover:bg-destructive/10 focus-visible:ring-destructive',
    },
    success: {
      bold: 'border-green-500 bg-green-500 text-green-950 hover:border-green-600 hover:bg-green-600 focus-visible:ring-green-500',
      light: 'border-green-300 bg-green-50 text-green-700 hover:border-green-400 hover:bg-green-100 focus-visible:ring-green-500',
      none: 'border-transparent bg-transparent text-green-700 hover:bg-green-500/10 focus-visible:ring-green-500',
    },
    warning: {
      bold: 'border-yellow-500 bg-yellow-500 text-yellow-950 hover:border-yellow-600 hover:bg-yellow-600 focus-visible:ring-yellow-500',
      light: 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:border-yellow-400 hover:bg-yellow-100 focus-visible:ring-yellow-500',
      none: 'border-transparent bg-transparent text-yellow-700 hover:bg-yellow-500/10 focus-visible:ring-yellow-500',
    },
    info: {
      bold: 'border-violet-500 bg-violet-500 text-white hover:border-violet-600 hover:bg-violet-600 focus-visible:ring-violet-500',
      light: 'border-violet-300 bg-violet-50 text-violet-700 hover:border-violet-400 hover:bg-violet-100 focus-visible:ring-violet-500',
      none: 'border-transparent bg-transparent text-violet-700 hover:bg-violet-500/10 focus-visible:ring-violet-500',
    },
    light: {
      bold: 'border-slate-300 bg-slate-200 text-slate-800 hover:border-slate-400 hover:bg-slate-300 focus-visible:ring-slate-400',
      light: 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 focus-visible:ring-slate-400',
      none: 'border-transparent bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400',
    },
  };

  sizeClasses: Record<ButtonProps['size'], string> = {
    small: 'px-3 py-1 text-xs',
    medium: 'px-5 py-2 text-sm',
    large: 'px-7 py-2.5 text-lg',
  };

  shapeClasses: Record<ButtonProps['shape'], string> = {
    square: 'rounded-none',
    rounded: 'rounded-lg',
    pill: 'rounded-full',
  };

  shadowClasses: Record<ButtonProps['shadow'], string> = {
    none: '',
    small: 'shadow-sm',
    medium: 'shadow-md',
    large: 'shadow-lg',
  };

  constructor() {}

  ngOnInit(): void {
    this.classes = cx(
      this.baseClasses,
      this.impactClasses[this.tone()][this.impact()],
      this.sizeClasses[this.size()],
      this.shapeClasses[this.shape()],
      this.shadowClasses[this.shadow()],
      this.full() ? 'w-full' : '',
    );
  }

  onButtonClick() {
    if (this.disabled()) return;
    this.buttonClick.emit();
  }
}
