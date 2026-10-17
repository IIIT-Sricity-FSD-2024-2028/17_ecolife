import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

// These tests render the REAL app and hit the REAL running backend
// (seeded demo data). Nothing is mocked — they exist to prove the
// frontend and backend actually work together.

function renderAt(path) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

async function loginViaUi(email, password) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/email/i), email);
  await user.type(screen.getByLabelText(/^password/i), password);
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

const nav = () => within(document.querySelector('.sidebar'));

describe('Org portal — authentication & role-based navigation', () => {
  it('shows client-side validation errors without hitting the server', async () => {
    renderAt('/login');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('shows a server error message for wrong credentials', async () => {
    renderAt('/login');
    await loginViaUi('contributor@demo.tropos.dev', 'WrongPassword1!');
    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
  });

  it('Contributor: logs in, lands on dashboard, sees only contributor navigation', async () => {
    renderAt('/login');
    await loginViaUi('contributor@demo.tropos.dev', 'DemoPass1!');

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(await screen.findByText(/welcome back/i)).toBeInTheDocument();
    await waitFor(() => expect(nav().getByText('Data Submission')).toBeInTheDocument());
    expect(nav().getByText('Submission History')).toBeInTheDocument();
    expect(nav().getByText('Alerts')).toBeInTheDocument();
    expect(nav().getByText('Profile')).toBeInTheDocument();
    expect(nav().queryByText('Targets')).not.toBeInTheDocument();
    expect(nav().queryByText('Departments')).not.toBeInTheDocument();
    expect(nav().queryByText('Billing')).not.toBeInTheDocument();
    expect(nav().getByText('Contributor')).toBeInTheDocument();

    // Route guard: a Contributor navigating to an Org-Admin-only page is
    // bounced back to the dashboard instead of seeing that page.
    window.history.pushState({}, '', '/org-admin/people');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Departments' })).not.toBeInTheDocument();
  });

  it('Reviewer: lands on the org overview and sees methodology, targets, reports and amendments', async () => {
    renderAt('/login');
    await loginViaUi('reviewer@demo.tropos.dev', 'DemoPass1!');

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(nav().getByText('Targets')).toBeInTheDocument();
    expect(nav().getByText('Reports')).toBeInTheDocument();
    expect(nav().getByText('Submissions')).toBeInTheDocument();
    expect(nav().getByText('Emissions Analysis')).toBeInTheDocument();
    expect(nav().getByText('Amendments')).toBeInTheDocument();
    expect(nav().queryByText('Departments')).not.toBeInTheDocument();
    expect(nav().queryByText('Billing')).not.toBeInTheDocument();
  });

  it('Org Admin: sees org administration only — NOT Targets or Report Approval', async () => {
    renderAt('/login');
    await loginViaUi('owner@demo.tropos.dev', 'DemoPass1!');

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(nav().getByText('Departments & Staff')).toBeInTheDocument();
    expect(nav().getByText('Locations')).toBeInTheDocument();
    expect(nav().getByText('Billing')).toBeInTheDocument();
    expect(nav().getByText('Audit Log')).toBeInTheDocument();
    expect(nav().queryByText('Targets')).not.toBeInTheDocument();
    expect(nav().queryByText('Report Approval')).not.toBeInTheDocument();
  });

  it('Executive: sees Reports (approval authority) and nothing else operational', async () => {
    renderAt('/login');
    await loginViaUi('executive@demo.tropos.dev', 'DemoPass1!');

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(nav().getByText('Report Approval')).toBeInTheDocument();
    expect(nav().getByText('Amendment Approval')).toBeInTheDocument();
    expect(nav().queryByText('Targets')).not.toBeInTheDocument();
    expect(nav().queryByText('Departments & Staff')).not.toBeInTheDocument();
    expect(nav().queryByText('Data Submission')).not.toBeInTheDocument();
  });
});

describe('Route guards', () => {
  it('redirects an unauthenticated visitor from a protected page to login', async () => {
    renderAt('/org-admin/people');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});

describe('Organization registration form', () => {
  it('asks for a confirmation password and flags a mismatch live, without hitting the server', async () => {
    renderAt('/register');
    const user = userEvent.setup();

    // Step 1 -> step 2
    await user.type(await screen.findByLabelText(/^organization name/i), 'Acme');
    await user.type(screen.getByLabelText(/^full name/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/^email address/i), 'jane@acme.com');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await user.type(await screen.findByLabelText(/^password/i), 'StrongPass1');
    const confirm = screen.getByLabelText(/^confirm password/i);

    await user.type(confirm, 'StrongPass2');
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();

    await user.clear(confirm);
    await user.type(confirm, 'StrongPass1');
    expect(await screen.findByText('Passwords match')).toBeInTheDocument();
  });
});

describe('Admin portal', () => {
  it('Super Admin logs in on the separate portal and sees organizations', async () => {
    renderAt('/admin/login');
    await loginViaUi('superadmin@tropos.dev', 'SuperAdmin1!');

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(nav().getByText('Resource Governance')).toBeInTheDocument();
    expect(nav().getByText('Revenue')).toBeInTheDocument();
    expect(nav().getByText('Audit Log')).toBeInTheDocument();
    expect(nav().getByText('Admin Team')).toBeInTheDocument();
    expect(nav().getByText('Super Admin')).toBeInTheDocument();

    await userEvent.setup().click(nav().getByText('Organizations'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Organizations' })).toBeInTheDocument();
    expect(await screen.findByText('Demo Organization')).toBeInTheDocument();
  });

  it('org-portal credentials do NOT work on the admin portal', async () => {
    renderAt('/admin/login');
    await loginViaUi('owner@demo.tropos.dev', 'DemoPass1!');
    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
  });
});
