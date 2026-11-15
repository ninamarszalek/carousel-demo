import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the page heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Film Browser' })).toBeInTheDocument();
  });

  it('renders the header and the main landmark', () => {
    render(<App />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
