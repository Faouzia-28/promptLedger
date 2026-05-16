from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from app.api.auth import get_current_user
from app.core.template_store import get_templates, set_templates

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/scoring-templates")
async def get_scoring_templates(current: dict = Depends(get_current_user)):
    return get_templates()



class TemplateUpdateRequest(BaseModel):
    system_prompt: str
    user_template: str


@router.post("/scoring-templates")
async def update_scoring_templates(request: TemplateUpdateRequest, current: dict = Depends(get_current_user)):
    system = request.system_prompt.strip()
    user = request.user_template.strip()
    if not system or not user:
        raise HTTPException(status_code=400, detail="Both system_prompt and user_template are required")
    set_templates(system, user)
    return {"ok": True}
