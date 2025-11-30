from fastapi import APIRouter
from .. import schemas
import re

# ---------------------------------------------------------
# Autocomplete router:
# Handles POST /autocomplete requests
# ---------------------------------------------------------
router = APIRouter(
    prefix="/autocomplete",
    tags=["autocomplete"],
)

@router.post("/", response_model=schemas.AutocompleteResponse)
def autocomplete(body: schemas.AutocompleteRequest):
    """
    Simple rule-based autocomplete.

    Looks at the **word before the cursor** and returns a matching snippet.
    Supports partial words like:
      fo / for   → for i in range(): { ... }
      wh / whi   → while (): { ... }
      if / i     → if (): { ... }
      de / def   → def (): { ... }
      pr / pri   → print()
    """
    code = body.code
    language = body.language.lower()
    cursor_pos = body.cursorPosition or len(code)

    suggestion = ""

    # ---------------------------------------------------------
    # Only provide autocomplete for Python
    # ---------------------------------------------------------
    if language == "python":

        # Take everything before the cursor
        prefix = code[:cursor_pos]

        # Extract the last typed word (letters/numbers/_)
        match = re.search(r"([A-Za-z_][A-Za-z0-9_]*)$", prefix)
        last_word = match.group(1) if match else ""
        lw = last_word.lower()

        # ---------------------------------------------------------
        # Rule-based suggestions
        # ---------------------------------------------------------
        if lw.startswith("for"):
            suggestion = "for i in range(): {\n    \n}\n"
        elif lw.startswith("if"):
            suggestion = "if (): {\n    \n}\n"
        elif lw.startswith("wh"):   # while
            suggestion = "while (): {\n    \n}\n"
        elif lw.startswith("de"):   # def
            suggestion = "def (): {\n    \n}\n"
        elif lw.startswith("pr"):   # print
            suggestion = "print()"
        else:
            suggestion = ""  # no matching rule

    else:
        # No autocomplete rules for other languages yet
        suggestion = ""

    return schemas.AutocompleteResponse(suggestion=suggestion)
