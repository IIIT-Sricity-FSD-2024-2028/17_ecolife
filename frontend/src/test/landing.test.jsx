import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LandingPage } from '../pages/public/LandingPage';
import { AuthContext } from '../context/AuthContext';

function renderLanding(authUser = null) {
  return render(
    <AuthContext.Provider
      value={{
        user: authUser,
        login: async () => {},
        logout: () => {},
      }}
    >
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

describe('Tropos Production Landing Page', () => {
  it('renders the core headline, certifications, and primary CTAs', () => {
    renderLanding();

    expect(screen.getByText(/Carbon Accounting Built for Auditors/i)).toBeInTheDocument();
    expect(screen.getByText(/Engineered for Enterprise/i)).toBeInTheDocument();
    expect(screen.getByText(/ISO 14064-1 & GHG Protocol Corporate Standard Certified/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Start 14-Day Free Trial/i)[0]).toBeInTheDocument();
  });

  it('switches between Scope 1, Scope 2, and Scope 3 tabs', () => {
    renderLanding();

    // Default active tab is Scope 2
    expect(screen.getByText(/Dual-Reporting: Location vs Market-Based/i)).toBeInTheDocument();

    // Click Scope 1
    const scope1Tab = screen.getByRole('button', { name: /Scope 1: Direct Operations/i });
    fireEvent.click(scope1Tab);
    expect(screen.getByText(/Direct Fuel & Mobile Combustion/i)).toBeInTheDocument();

    // Click Scope 3
    const scope3Tab = screen.getByRole('button', { name: /Scope 3: Value Chain & Travel/i });
    fireEvent.click(scope3Tab);
    expect(screen.getByText(/Upstream & Downstream Value Chain/i)).toBeInTheDocument();
  });

  it('interactively recalculates metrics in the Carbon & Financial ROI Simulator', () => {
    renderLanding();

    const slider = screen.getByLabelText(/Monthly Electricity Usage/i);
    expect(slider).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('kWh/mo') && content.includes('250'))).toBeInTheDocument();

    // Move slider value
    fireEvent.change(slider, { target: { value: '600000' } });
    expect(screen.getByText((content) => content.includes('kWh/mo') && content.includes('600'))).toBeInTheDocument();
  });

  it('toggles between monthly and annual pricing with discount pill', () => {
    renderLanding();

    const toggleBtn = screen.getByLabelText(/Toggle annual or monthly billing/i);
    expect(screen.getByText(/\$1,199/i)).toBeInTheDocument(); // Annual price for Pro

    // Click to switch to monthly
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/\$1,499/i)).toBeInTheDocument(); // Monthly price for Pro
  });

  it('expands FAQ items on click', () => {
    renderLanding();

    const secondFaq = screen.getByText(/Which emission factor databases are pre-loaded in Tropos\?/i);
    fireEvent.click(secondFaq);
    expect(screen.getByText(/International Energy Agency/i)).toBeInTheDocument();
  });

  it('shows dashboard shortcut when user is logged in', () => {
    renderLanding({ name: 'Sarah Analyst', role: 'REVIEWER' });

    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText('reviewer')).toBeInTheDocument();
  });
});
