import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FloatField } from '../FloatField';

describe('FloatField', () => {
  it('renders label and placeholder', () => {
    render(<FloatField label="Test Label" placeholder="Test Placeholder" />);
    expect(screen.getByText('Test Label')).toBeDefined();
    expect(screen.getByPlaceholderText('Test Placeholder')).toBeDefined();
    
    // Label should float since placeholder is provided
    const label = screen.getByText('Test Label');
    expect(label.className).toMatch(/top-1/);
  });

  it('floats label when options are provided (select mode)', () => {
    render(<FloatField label="Select One" options={['Opt1', 'Opt2']} />);
    const label = screen.getByText('Select One');
    // It should have the small label class "top-1 text-[11px]"
    expect(label.className).toMatch(/top-1 text-\[11px\]/);
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
});
