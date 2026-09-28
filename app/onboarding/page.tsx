import { redirect } from "next/navigation";

// The apps (and old links) open /onboarding: the setup starts at its first step.
export default function OnboardingStart() {
  redirect("/onboarding/home");
}
