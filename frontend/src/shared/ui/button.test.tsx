import { render, screen } from '@testing-library/react';
import { Button } from '@/shared/ui/button';

describe('Button', () => {
  it('renders with its label', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies variant + size classes', () => {
    render(
      <Button variant="outline" size="sm">
        Outlined
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Outlined' });
    expect(btn.className).toContain('border');
  });
});
