import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Card, { CardHeader, CardTitle } from '../Card';
import DataTable from '../DataTable';
import StatCard from '../StatCard';
import PageHeader from '../PageHeader';
import Tabs from '../Tabs';
import Modal from '../Modal';

describe('Card', () => {
  it('renders children', () => {
    render(<Card><p>hello</p></Card>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('applies hover styles when hover prop is set', () => {
    const { container } = render(<Card hover>content</Card>);
    expect(container.firstChild).toHaveClass('cursor-pointer');
  });

  it('calls onClick when clicked', () => {
    const fn = vi.fn();
    render(<Card onClick={fn}>clickable</Card>);
    fireEvent.click(screen.getByText('clickable'));
    expect(fn).toHaveBeenCalledOnce();
  });

  it('applies padding class', () => {
    const { container } = render(<Card padding="lg">content</Card>);
    expect(container.firstChild).toHaveClass('p-6');
  });
});

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader><span>header</span></CardHeader>);
    expect(screen.getByText('header')).toBeInTheDocument();
  });
});

describe('CardTitle', () => {
  it('renders as h3', () => {
    render(<CardTitle>Title</CardTitle>);
    const el = screen.getByText('Title');
    expect(el.tagName).toBe('H3');
  });
});

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Total Runs" value={42} />);
    expect(screen.getByText('Total Runs')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<StatCard title="Rate" value="95%" subtitle="Last 24h" />);
    expect(screen.getByText('Last 24h')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(<StatCard title="Test" value={1} icon={<span>icon</span>} />);
    expect(screen.getByText('icon')).toBeInTheDocument();
  });

  it('shows trend with positive indicator', () => {
    render(<StatCard title="Test" value={1} trend={{ value: 12, positive: true }} />);
    expect(screen.getByText(/12%.*last period/)).toBeInTheDocument();
  });

  it('shows trend with negative indicator', () => {
    render(<StatCard title="Test" value={1} trend={{ value: 5, positive: false }} />);
    expect(screen.getByText(/5%.*last period/)).toBeInTheDocument();
  });

  it('applies variant class', () => {
    const { container } = render(<StatCard title="Test" value={1} variant="danger" />);
    expect(container.firstChild).toHaveClass('bg-red-50/80');
  });
});

describe('PageHeader', () => {
  it('renders title and subtitle', () => {
    render(<PageHeader title="Dashboard" subtitle="Welcome back" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('renders actions', () => {
    render(<PageHeader title="Test" actions={<button>Action</button>} />);
    expect(screen.getByRole('button', { name: /action/i })).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    const { container } = render(<PageHeader title="Test" />);
    expect(container.querySelector('p')).not.toBeInTheDocument();
  });
});

describe('Tabs', () => {
  const tabs = [
    { id: 'a', label: 'Tab A' },
    { id: 'b', label: 'Tab B' },
  ];

  it('renders all provided tabs', () => {
    render(<Tabs tabs={tabs} active="a" onChange={vi.fn()} />);
    expect(screen.getByText('Tab A')).toBeInTheDocument();
    expect(screen.getByText('Tab B')).toBeInTheDocument();
  });

  it('highlights the active tab', () => {
    const { container } = render(<Tabs tabs={tabs} active="a" onChange={vi.fn()} />);
    const activeBtn = screen.getByText('Tab A').closest('button');
    expect(activeBtn).toHaveClass('shadow-sm');
  });

  it('calls onChange when clicking a tab', () => {
    const fn = vi.fn();
    render(<Tabs tabs={tabs} active="a" onChange={fn} />);
    fireEvent.click(screen.getByText('Tab B'));
    expect(fn).toHaveBeenCalledWith('b');
  });
});

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<Modal open={false} onClose={vi.fn()} title="Test">content</Modal>);
    expect(container.innerHTML).toBe('');
  });

  it('renders title and children when open', () => {
    render(<Modal open={true} onClose={vi.fn()} title="My Modal">modal body</Modal>);
    expect(screen.getByText('My Modal')).toBeInTheDocument();
    expect(screen.getByText('modal body')).toBeInTheDocument();
  });

  it('calls onClose when clicking close button', () => {
    const fn = vi.fn();
    render(<Modal open={true} onClose={fn} title="Test">body</Modal>);
    fireEvent.click(screen.getByRole('button'));
    expect(fn).toHaveBeenCalledOnce();
  });

  it('calls onClose on Escape key', () => {
    const fn = vi.fn();
    render(<Modal open={true} onClose={fn} title="Test">body</Modal>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('DataTable', () => {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
  ];
  const data = [
    { id: '1', name: 'Alice', role: 'Admin' },
    { id: '2', name: 'Bob', role: 'User' },
  ];

  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} keyExtractor={(r) => r.id} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(<DataTable columns={columns} data={data} keyExtractor={(r) => r.id} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('calls onRowClick when clicking a row', () => {
    const fn = vi.fn();
    render(<DataTable columns={columns} data={data} keyExtractor={(r) => r.id} onRowClick={fn} />);
    const aliceRow = screen.getByText('Alice').closest('tr')!;
    fireEvent.click(aliceRow);
    expect(fn).toHaveBeenCalledWith(data[0]);
  });

  it('shows search input when searchable', () => {
    render(<DataTable columns={columns} data={data} keyExtractor={(r) => r.id} searchable />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('filters data by search term', () => {
    render(<DataTable columns={columns} data={data} keyExtractor={(r) => r.id} searchable />);
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'Alice' } });
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<DataTable columns={columns} data={[] as any[]} keyExtractor={(r) => r.id} emptyState={<p>Nothing here</p>} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows pagination when data exceeds pageSize', () => {
    const manyRows = Array.from({ length: 25 }, (_, i) => ({ id: String(i), name: `User ${i}`, role: 'dev' }));
    render(<DataTable columns={columns} data={manyRows} keyExtractor={(r) => r.id} pageSize={10} />);
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('25 total')).toBeInTheDocument();
  });

  it('sorts by column on header click', () => {
    render(<DataTable columns={columns} data={data} keyExtractor={(r) => r.id} />);
    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader);
    const cells = screen.getAllByRole('cell');
    expect(cells[0].textContent).toBe('Alice');
  });
});
