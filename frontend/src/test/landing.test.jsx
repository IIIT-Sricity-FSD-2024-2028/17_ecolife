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

describe('Tropos Official Enterprise Landing Page', () => {
  it('renders Tropos brand, primary navigation, and header action buttons', () => {
    renderLanding();

    expect(screen.getAllByText(/Tropos/i)[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Features$/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Resource Scopes$/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^How It Works$/i })[0]).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Pricing$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Contact$/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Sign In$/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Get Started$/i })[0]).toBeInTheDocument();
  });

  it('renders hero title, description, trust badges, and live Tropos preview card', () => {
    renderLanding();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Monitor\. Analyze\. Reduce\./i);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Carbon Footprint/i);

    expect(screen.getByText(/GHG Protocol Aligned/i)).toBeInTheDocument();
    expect(screen.getByText(/ISO 14064 Compatible/i)).toBeInTheDocument();
    expect(screen.getByText(/Audit Ready Reports/i)).toBeInTheDocument();

    expect(screen.getByText(/Demo Organization/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Grid Electricity/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Natural Gas/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Diesel Fuel/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/26\.00 t/i)).toBeInTheDocument();
  });

  it('renders trusted by industries bar and the 3 carbon challenge cards', () => {
    renderLanding();

    expect(screen.getByText(/TRUSTED BY SUSTAINABILITY TEAMS ACROSS SECTORS/i)).toBeInTheDocument();
    expect(screen.getByText(/Manufacturing/i)).toBeInTheDocument();
    expect(screen.getByText(/Logistics & Fleet/i)).toBeInTheDocument();
    expect(screen.getByText(/Real Estate/i)).toBeInTheDocument();

    expect(screen.getByText(/The Challenge of Carbon Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual Data Entry Errors/i)).toBeInTheDocument();
    expect(screen.getByText(/No Real-Time Visibility/i)).toBeInTheDocument();
    expect(screen.getByText(/Complex Compliance Reporting/i)).toBeInTheDocument();
  });

  it('renders comprehensive platform capabilities and native Tropos resources', () => {
    renderLanding();

    expect(screen.getByRole('heading', { name: /Comprehensive Emissions Management Platform/i })).toBeInTheDocument();
    expect(screen.getByText(/Live Dashboard Analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/Streamlined Data Submission & Approval/i)).toBeInTheDocument();
    expect(screen.getByText(/Proactive Threshold Monitoring/i)).toBeInTheDocument();

    expect(screen.getByText(/Track Every Operational Resource/i)).toBeInTheDocument();
    expect(screen.getByText(/Municipal Water/i)).toBeInTheDocument();
    expect(screen.getByText(/General Waste/i)).toBeInTheDocument();
  });

  it('renders 4-step workflow, lifecycle management, and impact metrics', () => {
    renderLanding();

    expect(screen.getByText(/How Tropos Works/i)).toBeInTheDocument();
    expect(screen.getByText(/Submit Data/i)).toBeInTheDocument();
    expect(screen.getByText(/Auto Calculate CO2/i)).toBeInTheDocument();
    expect(screen.getByText(/Analyze & Report/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Executive Approval/i })).toBeInTheDocument();

    expect(screen.getByText(/Complete Emissions Lifecycle Management/i)).toBeInTheDocument();
    expect(screen.getByText('47%')).toBeInTheDocument();
    expect(screen.getByText('99.8%')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders transparent Tropos subscription plans with billing toggle', () => {
    renderLanding();

    expect(screen.getByText(/Transparent Subscription Plans/i)).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();

    const toggleBtn = screen.getByLabelText(/Toggle annual or monthly pricing/i);
    expect(screen.getByText(/\$165/i)).toBeInTheDocument(); // Annual Growth plan price

    // Toggle to monthly
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/\$199/i)).toBeInTheDocument(); // Monthly Growth plan price
  });

  it('allows filling out the Get in Touch contact form and displays success state', () => {
    renderLanding();

    expect(screen.getByText(/Get in Touch/i)).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/^Name$/i);
    const emailInput = screen.getByLabelText(/^Email$/i);
    const companyInput = screen.getByLabelText(/^Company$/i);
    const messageInput = screen.getByLabelText(/^Message$/i);
    const submitBtn = screen.getByRole('button', { name: /Send Message/i });

    fireEvent.change(nameInput, { target: { value: 'Rachel Green' } });
    fireEvent.change(emailInput, { target: { value: 'rachel@acme.corp' } });
    fireEvent.change(companyInput, { target: { value: 'Acme Logistics' } });
    fireEvent.change(messageInput, { target: { value: 'Interested in fleet emissions tracking.' } });

    fireEvent.click(submitBtn);

    expect(screen.getByText(/Thank you! Your message has been received/i)).toBeInTheDocument();
  });

  it('shows dashboard button when user is logged in', () => {
    renderLanding({ name: 'Alex Analyst', role: 'REVIEWER' });

    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/Alex Analyst/i)).toBeInTheDocument();
  });
});
