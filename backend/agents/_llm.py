import os
from dotenv import load_dotenv

load_dotenv()

_LLM = None
_TRIED = False


def get_llm():
    global _LLM, _TRIED
    if _TRIED:
        return _LLM
    _TRIED = True
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        return None
    try:
        from langchain_groq import ChatGroq
        _LLM = ChatGroq(model="llama-3.3-70b-versatile", api_key=key, temperature=0.3)
    except Exception:
        _LLM = None
    return _LLM


def ask(prompt: str, fallback: str) -> str:
    llm = get_llm()
    if llm is None:
        return fallback
    try:
        resp = llm.invoke(prompt)
        return getattr(resp, "content", str(resp)).strip()
    except Exception:
        return fallback
