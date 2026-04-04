import type { ReactNode } from "react";
import TeacherVoiceAssistantLayer from "@/components/teacher/TeacherVoiceAssistantLayer";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <div className="teacher-voice-safe-space relative">
      {children}
      <TeacherVoiceAssistantLayer />
    </div>
  );
}
