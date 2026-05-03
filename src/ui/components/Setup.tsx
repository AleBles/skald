import { Box, Text, useStdout } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";
import type { Config } from "../../config/types.ts";

interface PromptItem {
    kind: "author" | "project";
    key: string;
}

type FieldStep = "name" | "detail";

interface SetupProps {
    config: Config;
    queue: PromptItem[];
    onDone: () => void;
    isInitial: boolean;
}

export function Setup({ config, queue, onDone, isInitial }: SetupProps) {
    const { stdout } = useStdout();
    const [index, setIndex] = useState(0);
    const [field, setField] = useState<FieldStep>("name");
    const [value, setValue] = useState("");
    const [nameValue, setNameValue] = useState("");

    if (queue.length === 0) {
        onDone();
        return null;
    }

    const current = queue[index] ?? queue[0];
    const total = queue.length;
    const isAuthor = current.kind === "author";

    const handleSubmit = (input: string) => {
        if (field === "name") {
            setNameValue(input || current.key);
            setValue("");
            setField("detail");
            return;
        }

        // Save entry
        if (isAuthor) {
            config.authors[current.key] = {
                name: nameValue || current.key,
                job_title: input || "",
            };
        } else {
            config.projects[current.key] = {
                name: nameValue || current.key,
                description: input || "",
            };
        }

        setValue("");
        setNameValue("");
        setField("name");

        if (index + 1 >= total) {
            onDone();
        } else {
            setIndex(index + 1);
        }
    };

    const label = isAuthor ? "Author" : "Project";
    const detailLabel = isAuthor ? "Job title" : "Short description";

    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            width={stdout.columns ?? 80}
        >
            {isInitial && index === 0 && field === "name" && (
                <Box marginBottom={1}>
                    <Text bold color="cyan">
                        Initial Setup
                    </Text>
                    <Text dimColor>
                        {" "}
                        - {total} new {total === 1 ? "entry" : "entries"} found
                        in feed history
                    </Text>
                </Box>
            )}

            <Box>
                <Text dimColor>
                    [{index + 1}/{total}]
                </Text>
                <Text bold color={isAuthor ? "yellow" : "green"}>
                    {" "}
                    {label}:{" "}
                </Text>
                <Text bold wrap="wrap">
                    {current.key}
                </Text>
            </Box>

            <Box marginTop={0}>
                {field === "name" ? (
                    <Box>
                        <Text> Display name [{current.key}]: </Text>
                        <TextInput
                            value={value}
                            onChange={setValue}
                            onSubmit={handleSubmit}
                            placeholder={current.key}
                        />
                    </Box>
                ) : (
                    <Box>
                        <Text> {detailLabel}: </Text>
                        <TextInput
                            value={value}
                            onChange={setValue}
                            onSubmit={handleSubmit}
                        />
                    </Box>
                )}
            </Box>
        </Box>
    );
}
