"""Custom refactoring code generation tool.

Wraps devstral with a professional system prompt for enterprise-grade
refactoring.  Unlike the generic ``code_gen`` tool, this tool:

* Establishes the LLM as a senior software engineer — not a teaching assistant.
* Does **not** hardcode a programming language; the orchestrator provides
  language context, expert guidelines, and a refactoring plan in the query.
* Instructs the model to output complete, production-ready files.
"""

import logging

from pydantic import Field

from nat.builder.builder import Builder
from nat.builder.framework_enum import LLMFrameworkEnum
from nat.builder.function_info import FunctionInfo
from nat.cli.register_workflow import register_function
from nat.data_models.component_ref import LLMRef
from nat.data_models.function import FunctionBaseConfig

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a senior software engineer performing production-grade refactoring \
for an enterprise codebase.

Rules you MUST follow:
- Apply the expert guidelines provided in the query. They are curated by \
framework authors and senior engineers; treat them as authoritative.
- Output the COMPLETE refactored file, ready to be saved as-is. \
Do not output diffs, partial snippets, or explanations mixed with code.
- If the refactoring plan needs adjustment because the code reveals \
something the plan missed, briefly state the adjustment BEFORE the \
code block, then output the full file.
- Preserve existing functionality unless the plan explicitly removes it.
- Keep imports clean, remove unused ones, and add any newly required ones.
"""


class RefactorGenConfig(FunctionBaseConfig, name="refactor_gen"):
    """Configuration for the refactoring code generation tool."""

    llm_name: LLMRef
    verbose: bool = False
    description: str = Field(
        default=(
            "Refactor existing code following a detailed plan and expert guidelines. "
            "Send a structured query containing <project_context>, <expert_guidelines>, "
            "<refactoring_plan>, and <current_file> sections. "
            "Returns the complete refactored file ready to be written with write_file."
        ),
    )


@register_function(config_type=RefactorGenConfig)
async def refactor_gen_tool(config: RefactorGenConfig, builder: Builder):
    from langchain_core.prompts.chat import ChatPromptTemplate

    logger.info("Initializing refactor_gen tool")
    llm = await builder.get_llm(config.llm_name, wrapper_type=LLMFrameworkEnum.LANGCHAIN)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("user", "{query}"),
        ]
    )
    chain = prompt | llm
    logger.info("Initialized refactor_gen tool")

    async def _refactor(query: str) -> str:
        """Generate refactored code from a structured query.

        The query should include project context, expert guidelines,
        the refactoring plan for the target file, and the current file
        content.  Returns the complete refactored file.
        """
        logger.info("Running refactor_gen tool")
        response = await chain.ainvoke({"query": query})
        result = response.text()
        if config.verbose:
            logger.debug("refactor_gen input:\n%s\nrefactor_gen output:\n%s", query, result)
        return result

    yield FunctionInfo.from_fn(_refactor, description=config.description)
