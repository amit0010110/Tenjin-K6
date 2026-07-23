import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OutputsManager from '../OutputsManager';

describe('OutputsManager', () => {
  it('renders empty state', () => {
    const onChange = vi.fn();
    render(<OutputsManager outputs={[]} onChange={onChange} />);
    expect(screen.getByText(/no outputs configured/i)).toBeTruthy();
  });

  it('renders configured outputs', () => {
    const outputs = [
      { type: 'cloud', enabled: true, config: {} },
      { type: 'influxdb', enabled: true, config: { url: 'http://localhost:8086/k6' } },
    ];
    render(<OutputsManager outputs={outputs as any} onChange={vi.fn()} />);
    const cloudElements = screen.getAllByText('k6 Cloud');
    expect(cloudElements.length).toBeGreaterThanOrEqual(1);
    const influxElements = screen.getAllByText('InfluxDB');
    expect(influxElements.length).toBeGreaterThanOrEqual(1);
  });

  it('opens the integration picker on button click', () => {
    render(<OutputsManager outputs={[]} onChange={vi.fn()} />);
    const btn = screen.getByText('Add Output');
    fireEvent.click(btn);
    expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
  });

  it('calls onChange when adding an output', () => {
    const onChange = vi.fn();
    render(<OutputsManager outputs={[]} onChange={onChange} />);

    // Open picker
    fireEvent.click(screen.getByText('Add Output'));
    // Click the cloud integration option
    const cloudOption = screen.getByText('k6 Cloud');
    fireEvent.click(cloudOption);

    expect(onChange).toHaveBeenCalledOnce();
    const newOutputs = onChange.mock.calls[0][0];
    expect(newOutputs).toHaveLength(1);
    expect(newOutputs[0].type).toBe('cloud');
    expect(newOutputs[0].enabled).toBe(true);
  });

  it('calls onChange when toggling output', () => {
    const outputs = [{ type: 'cloud', enabled: true, config: {} }];
    const onChange = vi.fn();
    render(<OutputsManager outputs={outputs as any} onChange={onChange} />);

    const toggleBtn = screen.getByText('✓');
    fireEvent.click(toggleBtn);

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0][0].enabled).toBe(false);
  });

  it('calls onChange when removing output', () => {
    const outputs = [
      { type: 'cloud', enabled: true, config: {} },
      { type: 'influxdb', enabled: true, config: { url: '' } },
    ];
    const onChange = vi.fn();
    render(<OutputsManager outputs={outputs as any} onChange={onChange} />);

    const removeButtons = screen.getAllByTitle('Remove output');
    fireEvent.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0]).toHaveLength(1);
    expect(onChange.mock.calls[0][0][0].type).toBe('influxdb');
  });

  it('shows config fields for outputs that have them', () => {
    const outputs = [
      { type: 'prometheus', enabled: true, config: { url: '' } },
    ];
    render(<OutputsManager outputs={outputs as any} onChange={vi.fn()} />);
    expect(screen.getByText('Remote Write URL')).toBeTruthy();
  });
});
