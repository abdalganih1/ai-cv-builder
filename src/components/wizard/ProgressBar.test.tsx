import { render } from '@testing-library/react';
import ProgressBar from './ProgressBar';
import { describe, it, expect } from 'vitest';

describe('ProgressBar', () => {
    it('renders without crashing', () => {
        const { container } = render(<ProgressBar current={0} total={5} />);
        expect(container.firstChild).toBeDefined();
    });

    it('calculates width correctly', () => {
        // current=1, total=5 (0-based index means 1 is 25% of 4 steps?)
        // The component logic: Math.round((current / (total - 1)) * 100)
        // If current=2, total=5 -> 2/4 = 50%
        const { container } = render(<ProgressBar current={2} total={5} />);
        const bar = container.querySelector('.bg-accent') as HTMLElement;
        expect(bar.style.width).toBe('50%');
    });
});
