"""Prompt composition and runtime skill selection."""

from cognitive_code_agent.prompts.composer import build_active_skills_block
from cognitive_code_agent.prompts.composer import load_base_prompt
from cognitive_code_agent.prompts.composer import load_prompt_config
from cognitive_code_agent.prompts.composer import render_template

__all__ = ["build_active_skills_block", "load_base_prompt", "load_prompt_config", "render_template"]
