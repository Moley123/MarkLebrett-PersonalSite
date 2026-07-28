import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GematriaApp, { resolveValue } from './gematria/GematriaApp';

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/gematria" element={<GematriaApp />} />
      </Routes>
    </MemoryRouter>,
  );

describe('resolveValue', () => {
  it('reads a plain number', () => {
    expect(resolveValue('613', 'hechrachi')).toBe(613);
  });

  it('reads a Hebrew numeral', () => {
    expect(resolveValue('תרי״ג', 'hechrachi')).toBe(613);
  });

  it('calculates Hebrew words with the chosen method', () => {
    expect(resolveValue('תורה', 'hechrachi')).toBe(611);
    expect(resolveValue('תורה', 'siduri')).toBe(53);
  });

  it('is 0 for empty input', () => {
    expect(resolveValue('', 'hechrachi')).toBe(0);
  });
});

describe('GematriaApp', () => {
  it('renders and reads the query from the URL', () => {
    renderAt('/gematria?q=%D7%AA%D7%95%D7%A8%D7%94');
    expect(screen.getByRole('heading', { name: /gematria explorer/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('תורה')).toBeInTheDocument();
    // 611 shows in the hero and again in the Hechrachi method card.
    expect(screen.getAllByText('611').length).toBeGreaterThanOrEqual(2);
    // The Hebrew numeral form is rendered alongside it.
    expect(screen.getByText(/תרי״א/)).toBeInTheDocument();
  });

  it('offers every method for a Hebrew word', () => {
    renderAt('/gematria?q=%D7%AA%D7%95%D7%A8%D7%94');
    expect(screen.getByText('53')).toBeInTheDocument(); // Siduri
    expect(screen.getByText('612')).toBeInTheDocument(); // Kolel
  });

  it('shows the mode nav', () => {
    renderAt('/gematria');
    ['Calculator', 'Compare', 'Bridge', 'Dates', 'Trends', 'Word Race'].forEach((label) => {
      expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    });
  });

  it('switches view from the URL', () => {
    renderAt('/gematria?mode=compare');
    expect(screen.getByText(/compare words/i)).toBeInTheDocument();
  });
});
