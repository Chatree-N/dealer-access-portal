import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Stepper } from '../Stepper';

describe('Stepper', () => {
  it('renders current step and step details', () => {
    render(<Stepper currentStep={2} />);
    expect(screen.getByText('Branch code')).toBeDefined();
    expect(screen.getByText('Your details')).toBeDefined();
    expect(screen.getByText('Consent & signature')).toBeDefined();
  });

  it('marks previous steps as complete', () => {
    render(<Stepper currentStep={2} />);
    // Step 1 is complete, should not have number 1
    expect(screen.queryByText('1')).toBeNull();
    // Step 3 is not complete, should show number 3
    expect(screen.getByText('3')).toBeDefined();
  });
});
