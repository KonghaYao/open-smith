"""A simple chatbot."""

from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

llm = ChatOpenAI(model="gpt-4o-mini", stream_usage=True)

graph = create_react_agent(
    llm,
    tools=[],
    prompt="You are a friendly, curious, geeky AI.",
)
