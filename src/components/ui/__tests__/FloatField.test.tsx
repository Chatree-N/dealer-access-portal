import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FloatField } from '../FloatField';

describe('FloatField', () => {
  it('renders label and placeholder', () => {
    render(<FloatField label="Test Label" placeholder="Test Placeholder" />);
    expect(screen.getByText('Test Label')).toBeDefined();
    expect(screen.getByPlaceholderText('Test Placeholder')).toBeDefined();
  });

  it('renders error state correctly', () => {
    render(<FloatField label="Email" error="Invalid email" />);
    expect(screen.getByText(/Error:/i)).toBeDefined();
    expect(screen.getByText(/Invalid email/)).toBeDefined();
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
  });

  it('handles options to render a select', () => {
    render(<FloatField label="Select One" options={['Opt1', 'Opt2']} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeDefined();
    expect(screen.getByRole('option', { name: 'Opt1' })).toBeDefined();
  });

  it('composes onFocus/onBlur with spread props', () => {
    let focusCalled = false;
    let blurCalled = false;
    
    render(
      <FloatField 
        label="Composed Events" 
        onFocus={() => focusCalled = true}
        onBlur={() => blurCalled = true}
      />
    );
    
    const input = screen.getByRole('textbox');
    let fieldset = input.closest('fieldset');
    
    // Initial border (not violet #6D3FE0)
    expect(fieldset?.style.borderColor).not.toContain('rgb(109, 63, 224)');
    expect(fieldset?.style.borderColor).not.toContain('#6D3FE0');
    
    // Focus
    fireEvent.focus(input);
    expect(focusCalled).toBe(true);
    
    // Should have violet border
    fieldset = input.closest('fieldset');
    const borderColor = fieldset?.style.borderColor;
    const hasViolet = borderColor === '#6D3FE0' || borderColor === '#6d3fe0' || borderColor?.includes('109, 63, 224');
    expect(hasViolet).toBe(true);
    
    // Blur
    fireEvent.blur(input);
    expect(blurCalled).toBe(true);
    
    // Should no longer have violet border
    fieldset = input.closest('fieldset');
    const blurredColor = fieldset?.style.borderColor;
    const stillHasViolet = blurredColor === '#6D3FE0' || blurredColor === '#6d3fe0' || blurredColor?.includes('109, 63, 224');
    expect(stillHasViolet).toBe(false);
  });
});
