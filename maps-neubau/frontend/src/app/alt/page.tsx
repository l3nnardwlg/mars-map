import MarsScene from '@/components/canvas/MarsScene';
import MissionHUD from '@/components/ui/MissionHUD';
import OnboardingModal from '@/components/ui/OnboardingModal';

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">
      {/* 3D WebGL Mars Engine */}
      <MarsScene />

      {/* Futuristic Mission Control HUD Overlay */}
      <MissionHUD />

      {/* 15-Second First-Time User Onboarding */}
      <OnboardingModal />
    </main>
  );
}
