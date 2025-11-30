from fastapi import APIRouter
from .. import schemas
import re

router = APIRouter(
    prefix="/autocomplete",
    tags=["autocomplete"],
)


@router.post("/", response_model=schemas.AutocompleteResponse)
def autocomplete(body: schemas.AutocompleteRequest):
    """
    Rule-based autocomplete.

    Uses the word right before the cursor and returns snippets with
    braces and indentation.

    Supports PREFIXES, e.g.:
      fo / for    -> for i in range(): { ... }
      wh / whi... -> while (): { ... }
      if / i      -> if (): { ... }
      de / def    -> def (): { ... }
      pr / pri... -> print()
    """
    code = body.code
    language = body.language.lower()
    cursor_pos = body.cursorPosition or len(code)

    suggestion = ""

    if language == "python":
        prefix = code[:cursor_pos]

        # Last word before cursor
        match = re.search(r"([A-Za-z_][A-Za-z0-9_]*)$", prefix)
        last_word = match.group(1) if match else ""
        lw = last_word.lower()

        if lw.startswith("for"):
            suggestion = "for i in range(): {\n    \n}\n"
        elif lw.startswith("if"):
            suggestion = "if (): {\n    \n}\n"
        elif lw.startswith("wh"):  # while
            suggestion = "while (): {\n    \n}\n"
        elif lw.startswith("de"):  # def
            suggestion = "def (): {\n    \n}\n"
        elif lw.startswith("pr"):  # print
            suggestion = "print()"
        else:
            # No rule -> no suggestion
            suggestion = ""
    else:
        # No rules for other languages yet
        suggestion = ""

    return schemas.AutocompleteResponse(suggestion=suggestion)
