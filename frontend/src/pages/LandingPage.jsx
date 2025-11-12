// =====================================================
// 15. src/pages/LandingPage.jsx
// =====================================================

import { Link } from "react-router-dom";
import {
  Activity,
  Shield,
  BarChart,
  Bell,
  CheckCircle,
  Award,
} from "lucide-react";

export default function LandingPage() {
  const features = [
    {
      icon: Activity,
      title: "Real-time Monitoring",
      description:
        "Track equipment status, health, and performance in real-time across all labs",
    },
    {
      icon: Shield,
      title: "Predictive Maintenance",
      description:
        "AI-powered alerts prevent breakdowns before they happen, reducing downtime",
    },
    {
      icon: BarChart,
      title: "Usage Analytics",
      description:
        "Comprehensive insights on equipment utilization and efficiency metrics",
    },
    {
      icon: Bell,
      title: "Instant Alerts",
      description:
        "Get notified of faults, malfunctions, or unsafe usage patterns immediately",
    },
  ];

  const benefits = [
    "Reduce equipment downtime by up to 40%",
    "Improve training quality and safety",
    "Optimize resource allocation",
    "Generate automated compliance reports",
    "Scale across multiple institutions",
    "Industry 4.0 ready infrastructure",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-900" />
            <h1 className="text-2xl font-bold text-blue-900">
              IoT Equipment Monitor
            </h1>
          </div>
          <div className="flex gap-4">
            <Link
              to="/login"
              className="px-4 py-2 text-blue-900 hover:text-blue-700"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="px-6 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto mb-20">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Smart Equipment Monitoring for{" "}
            <span className="text-blue-900">Skill Training Labs</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Real-time IoT & AI-powered monitoring system for vocational training
            equipment across India. Ensure optimal utilization, predictive
            maintenance, and enhanced safety for ITIs, polytechnics, and
            training centers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="px-8 py-4 bg-blue-900 text-white text-lg rounded-lg hover:bg-blue-800 transition-colors shadow-lg"
            >
              Get Started Free
            </Link>
            <Link
              to="/help"
              className="px-8 py-4 border-2 border-blue-900 text-blue-900 text-lg rounded-lg hover:bg-blue-50 transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <feature.icon className="w-12 h-12 text-blue-900 mb-4" />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Benefits Section */}
        <div className="bg-white rounded-2xl p-12 mb-20 shadow-sm border border-gray-100">
          <h3 className="text-3xl font-bold text-center mb-12">
            Why Choose Our Platform?
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-blue-900 text-white rounded-2xl p-12 text-center">
          <Award className="w-16 h-16 mx-auto mb-6" />
          <h3 className="text-3xl font-bold mb-4">
            Transform Your Training Lab Today
          </h3>
          <p className="text-xl mb-8 text-blue-100 max-w-2xl mx-auto">
            Join hundreds of institutions across India improving training
            quality, reducing equipment costs, and ensuring learner safety
          </p>
          <Link
            to="/signup"
            className="inline-block px-8 py-4 bg-white text-blue-900 text-lg rounded-lg hover:bg-gray-100 transition-colors shadow-lg font-semibold"
          >
            Create Free Account
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-20 border-t border-gray-200">
        <div className="text-center text-gray-600">
          <p>
            &copy; 2025 IoT Equipment Monitor. Ministry of Skill Development &
            Entrepreneurship
          </p>
        </div>
      </footer>
    </div>
  );
}
