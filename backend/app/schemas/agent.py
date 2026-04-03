from app.schemas.common import FlexibleModel


class ParentSuggestionRequest(FlexibleModel):
    pass


class ParentFollowUpRequest(FlexibleModel):
    pass


class TeacherAgentRequest(FlexibleModel):
    pass


class AdminAgentRequest(FlexibleModel):
    pass


class WeeklyReportRequest(FlexibleModel):
    pass


class HighRiskConsultationRequest(FlexibleModel):
    pass


class StreamAgentRequest(FlexibleModel):
    prompt: str | None = None
