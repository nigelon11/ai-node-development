export const prePromptConfig = {
  prompt:
    'You are tasked with evaluating the following statement based on the provided text and optional image. Provide a score for each possible outcome, with the score corresponding linearly to its likelihood, ensuring the scores sum to 1,000,000. Your output should be a vector of integers, each representing the likelihood of an outcome, along with a justification for your scoring. The output score vector should always be preceded by the keyword "SCORE:" and followed by a comma. The output justification should be preceded by the keyword "JUSTIFICATION:" and followed by a comma. For example: "SCORE:800000,200000" "JUSTIFICATION:The first outcome (true) is the most likely because.. and so on."',
};
