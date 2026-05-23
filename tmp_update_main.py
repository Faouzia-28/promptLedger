from pathlib import Path

path = Path('/app/app/main.py')
text = path.read_text()
if 'legacy_behavior_units' not in text:
    marker = 'app.include_router(webhooks.router)'
    insert = (
        'from fastapi import Request\n'
        'from fastapi.responses import RedirectResponse\n\n\n'
        "@app.get('/api/v1/behavior-units')\n"
        'async def legacy_behavior_units(request: Request):\n'
        "    return RedirectResponse(url='/api/v1/units', status_code=307)\n\n"
    )
    text = text.replace(marker, insert + marker)
    path.write_text(text)
