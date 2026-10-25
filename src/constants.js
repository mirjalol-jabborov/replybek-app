import { tk } from "./i18n.js";
// Choices offered in Settings.
export const TIMEZONES = [
  ["Pacific/Honolulu", "Hawaii", "UTC−10"],
  ["America/Anchorage", "Alaska", "UTC−9"],
  ["America/Los_Angeles", "Pacific Time", "UTC−8"],
  ["America/Denver", "Mountain Time", "UTC−7"],
  ["America/Phoenix", "Arizona", "UTC−7"],
  ["America/Chicago", "Central Time", "UTC−6"],
  ["America/New_York", "Eastern Time", "UTC−5"],
  ["America/Toronto", "Toronto", "UTC−5"],
  ["America/Sao_Paulo", "São Paulo", "UTC−3"],
  ["Europe/London", "London", "UTC+0"],
  ["Europe/Dublin", "Dublin", "UTC+0"],
  ["Europe/Paris", "Paris", "UTC+1"],
  ["Europe/Berlin", "Berlin", "UTC+1"],
  ["Europe/Stockholm", "Stockholm", "UTC+1"],
  ["Africa/Johannesburg", "Johannesburg", "UTC+2"],
  ["Asia/Dubai", "Dubai", "UTC+4"],
  ["Asia/Kolkata", "India", "UTC+5:30"],
  ["Asia/Singapore", "Singapore", "UTC+8"],
  ["Asia/Tokyo", "Tokyo", "UTC+9"],
  ["Australia/Sydney", "Sydney", "UTC+10"],
  ["Pacific/Auckland", "Auckland", "UTC+12"],
];

export const ACCENTS = ["#1f3d36", "#1d4ed8", "#9a3412", "#7c2d12", "#334155", "#0f766e", "#3f6212", "#be123c"];

export const PLANS = [
  { id: "starter", name: "Starter", price: 29, features: [tk("1 agent"), tk("2,000 AI messages / month"), tk("2 team seats"), tk("10 knowledge sources"), tk("Replybek branding on the widget")] },
  { id: "growth", name: "Growth", price: 79, features: [tk("5 agents"), tk("10,000 AI messages / month"), tk("5 team seats"), tk("50 knowledge sources"), tk("Remove widget branding")] },
  { id: "business", name: "Business", price: 199, features: [tk("20 agents"), tk("50,000 AI messages / month"), tk("15 team seats"), tk("250 knowledge sources"), tk("Priority support")] },
];
