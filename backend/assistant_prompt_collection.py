import yaml

def load_yaml_data(filepath: str):
    with open(filepath, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data

system_prompts = load_yaml_data("./prompt_collection_test.yaml")


class AssistantPrompts:
    def __init__(self, db_description):
        self.db_description = db_description
        self.PLANNER_SYSTEM_PROMPT = system_prompts["PLANNER_SYSTEM_PROMPT"].format(db_description=db_description)
        self.SQL_PROMPT = system_prompts["SQL_PROMPT"].format(db_description=db_description)
        self.TRANSLATOR_SYSTEM_PROMPT = system_prompts["TRANSLATOR_SYSTEM_PROMPT"] + self.SQL_PROMPT
        self.INTERPRETER_SYSTEM_PROMPT = system_prompts["INTERPRETER_SYSTEM_PROMPT"]
        self.SQL_CRITIQUE_PROMPT = system_prompts["SQL_CRITIQUE_PROMPT"] + self.SQL_PROMPT