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
    'flex items-center justify-center border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none';

  // Solo tokens del tema (styles.css): se adaptan al modo oscuro y al color de tema sin `dark:`.
  impactClasses: Record<ButtonProps['tone'], Record<ButtonProps['impact'], string>> = {
    primary: {
      bold: 'border-primary bg-primary text-primary-foreground hover:border-primary/90 hover:bg-primary/90 focus-visible:ring-primary',
      light: 'border-primary/25 bg-primary/15 text-primary hover:border-primary/35 hover:bg-primary/25 focus-visible:ring-primary',
      none: 'border-transparent bg-transparent text-primary hover:bg-primary/10 focus-visible:ring-primary',
    },
    danger: {
      bold: 'border-destructive bg-destructive text-destructive-foreground hover:border-destructive/90 hover:bg-destructive/90 focus-visible:ring-destructive',
      light: 'border-destructive/25 bg-destructive/15 text-destructive hover:border-destructive/35 hover:bg-destructive/25 focus-visible:ring-destructive',
      none: 'border-transparent bg-transparent text-destructive hover:bg-destructive/10 focus-visible:ring-destructive',
    },
    success: {
      bold: 'border-success bg-success text-success-foreground hover:border-success/90 hover:bg-success/90 focus-visible:ring-success',
      light: 'border-success-300 bg-success-50 text-success-800 hover:border-success-400 hover:bg-success-100 focus-visible:ring-success',
      none: 'border-transparent bg-transparent text-success-700 hover:bg-success/10 focus-visible:ring-success',
    },
    warning: {
      bold: 'border-warning bg-warning text-warning-foreground hover:border-warning/90 hover:bg-warning/90 focus-visible:ring-warning',
      light: 'border-warning-300 bg-warning-50 text-warning-800 hover:border-warning-400 hover:bg-warning-100 focus-visible:ring-warning',
      none: 'border-transparent bg-transparent text-warning-800 hover:bg-warning/10 focus-visible:ring-warning',
    },
    info: {
      bold: 'border-info bg-info text-info-foreground hover:border-info/90 hover:bg-info/90 focus-visible:ring-info',
      light: 'border-info-300 bg-info-50 text-info-800 hover:border-info-400 hover:bg-info-100 focus-visible:ring-info',
      none: 'border-transparent bg-transparent text-info-700 hover:bg-info/10 focus-visible:ring-info',
    },
    light: {
      bold: 'border-border bg-muted text-foreground hover:bg-muted-foreground/20 focus-visible:ring-muted-foreground',
      light: 'border-border bg-card text-foreground hover:bg-muted focus-visible:ring-muted-foreground',
      none: 'border-transparent bg-transparent text-foreground hover:bg-muted focus-visible:ring-muted-foreground',
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
