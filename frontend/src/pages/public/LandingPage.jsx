import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getHomePathForRole } from '../../utils/permissions';
import { Mark } from '../../components/layout/Brand';
import {
  BarChart3,
  Users,
  AlertTriangle,
  TrendingDown,
  FileText,
  Shield,
  Factory,
  Truck,
  Building,
  Zap,
  Droplets,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Flame,
  Trash2,
  Check,
  Calendar,
  Activity,
} from 'lucide-react';
import './LandingPage.css';

// Exact resource types supported natively in Tropos
const TROPOS_RESOURCES = [
  {
    name: 'Grid Electricity',
    category: 'Scope 2',
    unit: 'kWh',
    icon: Zap,
    factor: '0.417 kg CO₂ / kWh',
    source: 'EPA eGRID / Regional Grid',
  },
  {
    name: 'Natural Gas',
    category: 'Scope 1',
    unit: 'm³ / therms',
    icon: Flame,
    factor: '1.885 kg CO₂ / m³',
    source: 'EPA GHG Factors / Stationary',
  },
  {
    name: 'Diesel Fuel',
    category: 'Scope 1',
    unit: 'liters / gal',
    icon: Truck,
    factor: '2.680 kg CO₂ / liter',
    source: 'DEFRA / Mobile Combustion',
  },
  {
    name: 'Municipal Water',
    category: 'Resource',
    unit: 'm³ / liters',
    icon: Droplets,
    factor: '0.149 kg CO₂ / m³',
    source: 'Supply & Treatment Lifecycle',
  },
  {
    name: 'General Waste',
    category: 'Scope 3',
    unit: 'kg / tonnes',
    icon: Trash2,
    factor: '0.500 kg CH₄ / kg (GWP=28)',
    source: 'Landfill Decomposition',
  },
];

export function LandingPage() {
  const { user } = useAuth();

  // Billing toggle (monthly / annual)
  const [isAnnual, setIsAnnual] = useState(true);

  // Contact form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', company: '', message: '' });
    }, 4500);
  };

  return (
    <div className="tp-landing">
      {/* ---- 1. Sticky Navigation Bar ---- */}
      <header className="tp-header-wrap">
        <div className="tp-header">
          <Link to="/" className="tp-brand" aria-label="Tropos Home">
            <div className="tp-brand-icon">
              <Mark size={20} />
            </div>
            <span className="tp-brand-text">Tropos</span>
          </Link>

          <nav aria-label="Primary Navigation">
            <ul className="tp-nav-menu">
              <li>
                <a href="#features" className="tp-nav-link">
                  Features
                </a>
              </li>
              <li>
                <a href="#resources" className="tp-nav-link">
                  Resource Scopes
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="tp-nav-link">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#pricing" className="tp-nav-link">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#contact" className="tp-nav-link">
                  Contact
                </a>
              </li>
            </ul>
          </nav>

          <div className="tp-header-actions">
            {user ? (
              <div className="tp-user-badge">
                <span>{user?.name || user?.email || 'Logged in'}</span>
                <Link
                  to={getHomePathForRole(user?.role)}
                  className="tp-btn-primary"
                  style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                >
                  Dashboard <ArrowRight size={14} style={{ marginLeft: '4px' }} />
                </Link>
              </div>
            ) : (
              <>
                <Link to="/login" className="tp-btn-outline">
                  Sign In
                </Link>
                <Link to="/register" className="tp-btn-primary">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---- 2. Hero Section ---- */}
      <section className="tp-hero-section" id="hero">
        <div className="tp-hero-container">
          <div className="tp-hero-content">
            <div className="tp-hero-eyebrow">
              <Sparkles size={14} />
              <span>GHG Protocol &amp; ISO 14064 Compliance Platform</span>
            </div>

            <h1 className="tp-hero-title">
              Monitor. Analyze. Reduce.
              <br />
              Your Organization&apos;s
              <span className="tp-hero-highlight">Carbon Footprint</span>
            </h1>

            <p className="tp-hero-desc">
              Comprehensive electricity, fuel, natural gas, water, and waste tracking with
              real-time emissions analytics. Streamline compliance, eliminate spreadsheet errors,
              and achieve sustainability targets with 4-tier role-based governance.
            </p>

            <div className="tp-hero-ctas">
              <Link to="/register" className="tp-btn-primary">
                Get Started <ArrowRight size={16} />
              </Link>
              <a href="#features" className="tp-btn-white">
                Explore Features
              </a>
            </div>

            <div className="tp-hero-trust-list">
              <div className="tp-hero-trust-item">
                <CheckCircle2 size={18} className="tp-check-icon" />
                <span>GHG Protocol Aligned</span>
              </div>
              <div className="tp-hero-trust-item">
                <CheckCircle2 size={18} className="tp-check-icon" />
                <span>ISO 14064 Compatible</span>
              </div>
              <div className="tp-hero-trust-item">
                <CheckCircle2 size={18} className="tp-check-icon" />
                <span>Audit Ready Reports</span>
              </div>
            </div>
          </div>

          {/* Right Hero Preview Card */}
          <div className="tp-hero-preview-card">
            <div className="tp-preview-header">
              <div className="tp-preview-title-box">
                <div className="tp-preview-icon">
                  <Activity size={20} />
                </div>
                <div>
                  <div className="tp-preview-org-name">Demo Organization</div>
                  <div className="tp-preview-org-dept">Main Facility &bull; Current Period</div>
                </div>
              </div>
              <div className="tp-preview-status-pill">Active Audit</div>
            </div>

            <div className="tp-preview-metrics-list">
              <div className="tp-preview-metric-row">
                <div className="tp-preview-metric-left">
                  <Zap size={16} style={{ color: '#059669' }} />
                  <span>Grid Electricity</span>
                </div>
                <div className="tp-preview-metric-right">
                  <span className="tp-preview-metric-val">47,100 kWh</span>
                  <span className="tp-preview-badge-submitted">SUBMITTED</span>
                </div>
              </div>

              <div className="tp-preview-metric-row">
                <div className="tp-preview-metric-left">
                  <Flame size={16} style={{ color: '#d97706' }} />
                  <span>Natural Gas</span>
                </div>
                <div className="tp-preview-metric-right">
                  <span className="tp-preview-metric-val">745 m³</span>
                  <span className="tp-preview-badge-submitted">SUBMITTED</span>
                </div>
              </div>

              <div className="tp-preview-metric-row">
                <div className="tp-preview-metric-left">
                  <Truck size={16} style={{ color: '#2563eb' }} />
                  <span>Diesel Fuel</span>
                </div>
                <div className="tp-preview-metric-right">
                  <span className="tp-preview-metric-val">1,850 L</span>
                  <span className="tp-preview-badge-submitted">SUBMITTED</span>
                </div>
              </div>
            </div>

            <div className="tp-preview-footer">
              <div className="tp-preview-footer-total">
                Net Period CO₂e: <span>26.00 t</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>
                <Check size={14} /> EPA 2026 Factors Applied
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- 3. Trusted by Organizations Across Industries ---- */}
      <section className="tp-trusted-section" aria-label="Trusted Industries">
        <div className="tp-trusted-title">TRUSTED BY SUSTAINABILITY TEAMS ACROSS SECTORS</div>
        <div className="tp-trusted-grid">
          <div className="tp-trusted-item">
            <Factory size={20} />
            <span>Manufacturing</span>
          </div>
          <div className="tp-trusted-item">
            <Truck size={20} />
            <span>Logistics &amp; Fleet</span>
          </div>
          <div className="tp-trusted-item">
            <Building size={20} />
            <span>Real Estate</span>
          </div>
          <div className="tp-trusted-item">
            <Zap size={20} />
            <span>Energy</span>
          </div>
          <div className="tp-trusted-item">
            <Droplets size={20} />
            <span>Utilities</span>
          </div>
        </div>
      </section>

      {/* ---- 4. The Challenge of Carbon Management ---- */}
      <section className="tp-section" id="challenges">
        <div className="tp-container">
          <div className="tp-section-header">
            <h2 className="tp-section-title">The Challenge of Carbon Management</h2>
            <p className="tp-section-subtitle">
              Organizations struggle with manual tracking, compliance complexity, and lack of
              real-time insights
            </p>
          </div>

          <div className="tp-challenges-grid">
            <div className="tp-challenge-card">
              <div className="tp-challenge-icon-box">
                <AlertTriangle size={22} />
              </div>
              <h3 className="tp-challenge-title">Manual Data Entry Errors</h3>
              <p className="tp-challenge-desc">
                Spreadsheets lead to inconsistencies, delayed reporting, and compliance risks with
                costly audit findings.
              </p>
            </div>

            <div className="tp-challenge-card">
              <div className="tp-challenge-icon-box">
                <TrendingDown size={22} />
              </div>
              <h3 className="tp-challenge-title">No Real-Time Visibility</h3>
              <p className="tp-challenge-desc">
                Delayed insights prevent timely interventions, causing missed reduction
                opportunities and target overruns.
              </p>
            </div>

            <div className="tp-challenge-card">
              <div className="tp-challenge-icon-box">
                <FileText size={22} />
              </div>
              <h3 className="tp-challenge-title">Complex Compliance Reporting</h3>
              <p className="tp-challenge-desc">
                Fragmented data across departments makes regulatory reporting time-consuming and
                prone to errors.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- 5. Comprehensive Emissions Management Platform (Features) ---- */}
      <section className="tp-section" id="features" style={{ backgroundColor: '#ffffff' }}>
        <div className="tp-container">
          <div className="tp-section-header">
            <span className="tp-section-eyebrow">Platform Capabilities</span>
            <h2 className="tp-section-title">Comprehensive Emissions Management Platform</h2>
            <p className="tp-section-subtitle">
              Everything you need to track, analyze, and reduce your organization&apos;s carbon
              footprint
            </p>
          </div>

          <div className="tp-features-list">
            {/* Feature Row 1 */}
            <div className="tp-feature-row">
              <div className="tp-feature-visual">
                <BarChart3 className="tp-feature-visual-icon" />
              </div>
              <div>
                <span className="tp-pill-badge">Real-Time Monitoring</span>
                <h3 className="tp-feature-heading">Live Dashboard Analytics</h3>
                <p className="tp-feature-desc">
                  Track fuel consumption and emissions across all departments in real-time. Visual
                  dashboards provide instant insights into trends, targets, and threshold alerts.
                </p>
                <ul className="tp-feature-checklist">
                  <li className="tp-feature-check-item">
                    <CheckCircle2 size={18} />
                    <span>
                      Department-wise consumption breakdown with color-coded status indicators
                    </span>
                  </li>
                  <li className="tp-feature-check-item">
                    <CheckCircle2 size={18} />
                    <span>
                      Automated CO2 calculation using industry-standard emission factors
                    </span>
                  </li>
                  <li className="tp-feature-check-item">
                    <CheckCircle2 size={18} />
                    <span>Historical trend analysis and predictive insights</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Feature Row 2 (Reversed layout) */}
            <div className="tp-feature-row">
              <div>
                <span className="tp-pill-badge">Role-Based Workflows</span>
                <h3 className="tp-feature-heading">Streamlined Data Submission &amp; Approval</h3>
                <p className="tp-feature-desc">
                  Managers submit consumption data with automated validation. Analysts generate
                  comprehensive reports. Executives approve with full audit trails and revision
                  capabilities.
                </p>
                <ul className="tp-feature-checklist">
                  <li className="tp-feature-check-item">
                    <CheckCircle2 size={18} />
                    <span>Guided data entry with invoice upload and validation checklists</span>
                  </li>
                  <li className="tp-feature-check-item">
                    <CheckCircle2 size={18} />
                    <span>Automated report generation with customizable templates</span>
                  </li>
                  <li className="tp-feature-check-item">
                    <CheckCircle2 size={18} />
                    <span>Multi-level approval workflows with comment and revision system</span>
                  </li>
                </ul>
              </div>
              <div className="tp-feature-visual">
                <Users className="tp-feature-visual-icon" />
              </div>
            </div>

            {/* Feature Row 3 */}
            <div className="tp-feature-row">
              <div className="tp-feature-visual">
                <AlertTriangle className="tp-feature-visual-icon" />
              </div>
              <div>
                <span className="tp-pill-badge">Smart Alerts</span>
                <h3 className="tp-feature-heading">Proactive Threshold Monitoring</h3>
                <p className="tp-feature-desc">
                  Automated alerts when departments approach or exceed consumption targets.
                  Multi-level escalation ensures timely response and accountability.
                </p>
                <ul className="tp-feature-checklist">
                  <li className="tp-feature-check-item">
                    <CheckCircle2 size={18} />
                    <span>Severity-based alerts: Low, Medium, High, Critical</span>
                  </li>
                  <li className="tp-feature-check-item">
                    <CheckCircle2 size={18} />
                    <span>
                      Escalation workflows with manager explanations and executive oversight
                    </span>
                  </li>
                  <li className="tp-feature-check-item">
                    <CheckCircle2 size={18} />
                    <span>Complete audit trail and resolution tracking</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- 6. Native Resource Scopes Supported in Tropos ---- */}
      <section className="tp-section" id="resources" style={{ backgroundColor: '#f8fafc' }}>
        <div className="tp-container">
          <div className="tp-section-header">
            <span className="tp-section-eyebrow">Comprehensive Activity Intake</span>
            <h2 className="tp-section-title">Track Every Operational Resource</h2>
            <p className="tp-section-subtitle">
              Tropos normalizes consumption data across all primary emission categories with verified
              EPA and international factor sets.
            </p>
          </div>

          <div className="tp-resources-grid">
            {TROPOS_RESOURCES.map((res, i) => {
              const Icon = res.icon;
              return (
                <div key={i} className="tp-resource-card">
                  <div className="tp-resource-icon-box">
                    <Icon size={22} />
                  </div>
                  <div className="tp-resource-name">{res.name}</div>
                  <div className="tp-resource-scope">{res.category} &bull; {res.unit}</div>
                  <div className="tp-resource-factor">{res.factor}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- 7. How Tropos Works ---- */}
      <section className="tp-section tp-how-it-works-section" id="how-it-works">
        <div className="tp-container">
          <div className="tp-section-header">
            <span className="tp-section-eyebrow">End-to-End Workflow</span>
            <h2 className="tp-section-title">How Tropos Works</h2>
            <p className="tp-section-subtitle">
              Simple, streamlined process from data collection to executive approval
            </p>
          </div>

          <div className="tp-steps-container">
            <div className="tp-step-card">
              <div className="tp-step-number-circle">1</div>
              <h3 className="tp-step-title">Submit Data</h3>
              <p className="tp-step-desc">
                Department contributors enter resource usage and attach utility invoices with proof
                lockdown
              </p>
            </div>

            <div className="tp-step-card">
              <div className="tp-step-number-circle">2</div>
              <h3 className="tp-step-title">Auto Calculate CO2</h3>
              <p className="tp-step-desc">
                Tropos automatically maps EPA 2026 factors, converts units, and calculates net CO₂e
              </p>
            </div>

            <div className="tp-step-card">
              <div className="tp-step-number-circle">3</div>
              <h3 className="tp-step-title">Analyze &amp; Report</h3>
              <p className="tp-step-desc">
                Reviewers analyze department variances, track reduction targets, and compile formal reports
              </p>
            </div>

            <div className="tp-step-card">
              <div className="tp-step-number-circle">4</div>
              <h3 className="tp-step-title">Executive Approval</h3>
              <p className="tp-step-desc">
                Executives review, sign off with two-person governance, and export locked audit PDF reports
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- 8. Complete Emissions Lifecycle Management (Dark Navy Section) ---- */}
      <section className="tp-lifecycle-section">
        <div className="tp-container">
          <div className="tp-lifecycle-header">
            <h2 className="tp-lifecycle-title">Complete Emissions Lifecycle Management</h2>
            <p className="tp-lifecycle-subtitle">
              From data collection to strategic decision-making
            </p>
          </div>

          <div className="tp-lifecycle-grid">
            <div className="tp-lifecycle-card">
              <div className="tp-lifecycle-icon-box">
                <BarChart3 size={22} />
              </div>
              <h3 className="tp-lifecycle-card-title">Data Collection</h3>
              <p className="tp-lifecycle-card-desc">
                Multi-source fuel, electricity, water, and waste aggregation with automated validation and error checking
              </p>
            </div>

            <div className="tp-lifecycle-card">
              <div className="tp-lifecycle-icon-box">
                <Users size={22} />
              </div>
              <h3 className="tp-lifecycle-card-title">Analysis &amp; Reporting</h3>
              <p className="tp-lifecycle-card-desc">
                Advanced analytics with trend identification, comparative benchmarking, and science-based targets
              </p>
            </div>

            <div className="tp-lifecycle-card">
              <div className="tp-lifecycle-icon-box">
                <Shield size={22} />
              </div>
              <h3 className="tp-lifecycle-card-title">Compliance &amp; Action</h3>
              <p className="tp-lifecycle-card-desc">
                Regulatory reporting, target setting, tamper-evident audit logs, and strategic emission reduction planning
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- 9. Impact Metrics Banner ---- */}
      <section className="tp-impact-banner" aria-label="Key Impact Metrics">
        <div className="tp-impact-grid">
          <div>
            <div className="tp-impact-stat">47%</div>
            <div className="tp-impact-label">Average reduction in reporting time</div>
          </div>
          <div>
            <div className="tp-impact-stat">99.8%</div>
            <div className="tp-impact-label">Data accuracy with automated validation</div>
          </div>
          <div>
            <div className="tp-impact-stat">100%</div>
            <div className="tp-impact-label">Audit-ready compliance reports</div>
          </div>
        </div>
      </section>

      {/* ---- 10. Transparent Pricing (Real Tropos Subscription Plans) ---- */}
      <section className="tp-pricing-section" id="pricing">
        <div className="tp-container">
          <div className="tp-section-header">
            <span className="tp-section-eyebrow">Predictable Investment</span>
            <h2 className="tp-section-title">Transparent Subscription Plans</h2>
            <p className="tp-section-subtitle">
              Tailored for organizations at every stage of their carbon accounting and ESG journey
            </p>
          </div>

          <div className="tp-pricing-toggle-wrap">
            <span
              className={`tp-toggle-label ${!isAnnual ? 'is-active' : ''}`}
              onClick={() => setIsAnnual(false)}
            >
              Monthly Billing
            </span>
            <button
              type="button"
              className={`tp-toggle-btn ${isAnnual ? 'is-annual' : ''}`}
              onClick={() => setIsAnnual(!isAnnual)}
              aria-label="Toggle annual or monthly pricing"
            >
              <div className="tp-toggle-thumb" />
            </button>
            <span
              className={`tp-toggle-label ${isAnnual ? 'is-active' : ''}`}
              onClick={() => setIsAnnual(true)}
            >
              Annual Billing
            </span>
            <span className="tp-discount-badge">Save ~17% on Annual</span>
          </div>

          <div className="tp-pricing-grid">
            {/* Starter Plan */}
            <div className="tp-pricing-card">
              <div>
                <div className="tp-plan-name">Starter</div>
                <div className="tp-plan-desc">
                  For small teams starting to track emissions across one or two departments.
                </div>
                <div className="tp-plan-price-box">
                  <span className="tp-plan-price">$0</span>
                  <span className="tp-plan-period">/ month (Free tier)</span>
                </div>
                <ul className="tp-plan-features">
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> Up to 3 Departments &amp; 1 Location
                  </li>
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> Up to 10 Users (Contributors &amp; Reviewers)
                  </li>
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> 5 Core Resource Types (Power, Gas, Fuel, Water, Waste)
                  </li>
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> Monthly Reporting Frequency
                  </li>
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> Standard EPA Emission Factors
                  </li>
                </ul>
              </div>
              <Link to="/register" className="tp-btn-outline" style={{ width: '100%' }}>
                Get Started Free
              </Link>
            </div>

            {/* Growth Plan (Popular) */}
            <div className="tp-pricing-card is-popular">
              <div className="tp-popular-badge">Most Popular</div>
              <div>
                <div className="tp-plan-name">Growth</div>
                <div className="tp-plan-desc">
                  For growing organizations with several departments and regular reporting needs.
                </div>
                <div className="tp-plan-price-box">
                  <span className="tp-plan-price">
                    ${isAnnual ? '165' : '199'}
                  </span>
                  <span className="tp-plan-period">/ month {isAnnual ? '($1,990/yr)' : ''}</span>
                </div>
                <ul className="tp-plan-features">
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> Up to 15 Departments &amp; Facilities
                  </li>
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> Up to 50 Users across all 4 Governance Roles
                  </li>
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> Up to 20 Resource Types &amp; Factor Mappings
                  </li>
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> Target Setting &amp; Smart Threshold Alerts
                  </li>
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> Full Revision &amp; Amendment Approval Trail
                  </li>
                </ul>
              </div>
              <Link to="/register" className="tp-btn-primary" style={{ width: '100%' }}>
                Start 14-Day Free Trial <ArrowRight size={16} />
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="tp-pricing-card">
              <div>
                <div className="tp-plan-name">Enterprise</div>
                <div className="tp-plan-desc">
                  For large organizations that need unlimited scale, custom factors, and weekly reporting.
                </div>
                <div className="tp-plan-price-box">
                  <span className="tp-plan-price">
                    ${isAnnual ? '832' : '999'}
                  </span>
                  <span className="tp-plan-period">/ month {isAnnual ? '($9,990/yr)' : ''}</span>
                </div>
                <ul className="tp-plan-features">
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> Unlimited Departments &amp; Global Facilities
                  </li>
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> Unlimited Users with strict Segregation of Duties
                  </li>
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> Unlimited Custom Emission Factors
                  </li>
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> Weekly Reporting Frequency &amp; Executive PDF Sign-Off
                  </li>
                  <li className="tp-plan-feature-item">
                    <Check size={16} /> Dedicated External Auditor Read-Only Portals &amp; SLA
                  </li>
                </ul>
              </div>
              <Link to="/register" className="tp-btn-outline" style={{ width: '100%' }}>
                Contact Enterprise Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---- 11. Get in Touch (Contact Form Card) ---- */}
      <section className="tp-contact-section" id="contact">
        <div className="tp-container">
          <div className="tp-section-header">
            <h2 className="tp-section-title">Get in Touch</h2>
            <p className="tp-section-subtitle">
              Have questions about Tropos or need a custom onboarding plan? Send us a message and
              our sustainability engineering team will respond promptly.
            </p>
          </div>

          <div className="tp-contact-card">
            {submitted && (
              <div className="tp-contact-alert">
                Thank you! Your message has been received. Our sustainability team will be in touch shortly.
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="tp-form-row-two">
                <div className="tp-form-group">
                  <label htmlFor="tp-name" className="tp-form-label">
                    Name
                  </label>
                  <input
                    id="tp-name"
                    type="text"
                    required
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="tp-input"
                  />
                </div>
                <div className="tp-form-group">
                  <label htmlFor="tp-email" className="tp-form-label">
                    Email
                  </label>
                  <input
                    id="tp-email"
                    type="email"
                    required
                    placeholder="john@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="tp-input"
                  />
                </div>
              </div>

              <div className="tp-form-group">
                <label htmlFor="tp-company" className="tp-form-label">
                  Company
                </label>
                <input
                  id="tp-company"
                  type="text"
                  placeholder="Your Organization"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="tp-input"
                />
              </div>

              <div className="tp-form-group">
                <label htmlFor="tp-message" className="tp-form-label">
                  Message
                </label>
                <textarea
                  id="tp-message"
                  rows={4}
                  placeholder="Tell us about your organization's carbon accounting requirements..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="tp-textarea"
                />
              </div>

              <button type="submit" className="tp-submit-btn">
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ---- 12. Dark Navy Footer ---- */}
      <footer className="tp-footer">
        <div className="tp-footer-grid">
          <div>
            <Link to="/" className="tp-footer-brand-title">
              <div className="tp-brand-icon">
                <Mark size={18} />
              </div>
              <span>Tropos</span>
            </Link>
            <p className="tp-footer-desc">
              Comprehensive emissions management platform for modern organizations. Track resource
              use, eliminate audit risk, and report verifiably.
            </p>
          </div>

          <div>
            <div className="tp-footer-col-title">PRODUCT</div>
            <ul className="tp-footer-links">
              <li>
                <a href="#features" className="tp-footer-link">
                  Features
                </a>
              </li>
              <li>
                <a href="#resources" className="tp-footer-link">
                  Resource Scopes
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="tp-footer-link">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#pricing" className="tp-footer-link">
                  Pricing Plans
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="tp-footer-col-title">ORGANIZATION PORTAL</div>
            <ul className="tp-footer-links">
              <li>
                <Link to="/login" className="tp-footer-link">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/register" className="tp-footer-link">
                  Start Free Trial
                </Link>
              </li>
              <li>
                <Link to="/admin/login" className="tp-footer-link">
                  Platform Admin Portal
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="tp-footer-col-title">STANDARDS &amp; GOVERNANCE</div>
            <ul className="tp-footer-links">
              <li>
                <span className="tp-footer-link">GHG Protocol Standards</span>
              </li>
              <li>
                <span className="tp-footer-link">ISO 14064-1 &amp; 14064-3</span>
              </li>
              <li>
                <span className="tp-footer-link">EPA 2026 GHG Emission Hub</span>
              </li>
              <li>
                <span className="tp-footer-link">Audit Trail Immutability</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="tp-footer-bottom">
          <div>
            &copy; {new Date().getFullYear()} Tropos Technologies Inc. All rights reserved. Built with
            care for sustainability.
          </div>
          <div className="tp-footer-bottom-links">
            <a href="#challenges">Challenges</a>
            <a href="#features">Features</a>
            <Link to="/login">Sign In</Link>
            <Link to="/admin/login">Platform Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
