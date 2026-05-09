"""SemanticDiffAgent - Compares versions using embeddings and LLM judge."""
import json
import random
import numpy as np
from typing import Optional
from app.agents.base import BaseAgent
from app.services.embed_service import embedder
from app.services.llm_service import llm


class SemanticDiffAgent(BaseAgent):
    """The Comparator - Analyzes behavioral changes between versions."""

    async def compare_versions(self, old_version, new_version, eval_cases: list[dict]) -> dict:
        """Compare two BehaviorVersions behaviorally using embeddings and LLM judge."""
        N = min(len(eval_cases), 15) if eval_cases else 0
        sample = eval_cases[:N] if eval_cases else []
        
        if not sample:
            return {
                'embedding_distance': 0.0,
                'refusal_rate_delta': 0.0,
                'length_delta': 0.0,
                'judge_scores': {},
                'summary': 'No evaluation cases to compare',
                'samples_compared': 0
            }

        old_outputs, new_outputs, successful_cases = [], [], []
        for case in sample:
            try:
                old_out = await self._run_version(old_version, case.get('input', ''))
                new_out = await self._run_version(new_version, case.get('input', ''))
                old_outputs.append(old_out)
                new_outputs.append(new_out)
                successful_cases.append(case)
            except Exception:
                continue

        if not old_outputs or not new_outputs:
            return {
                'embedding_distance': 0.0,
                'refusal_rate_delta': 0.0,
                'length_delta': 0.0,
                'judge_scores': {},
                'summary': 'Failed to run versions',
                'samples_compared': len(old_outputs)
            }

        old_embeds = embedder.embed_batch(old_outputs)
        new_embeds = embedder.embed_batch(new_outputs)

        old_centroid = embedder.centroid(old_embeds)
        new_centroid = embedder.centroid(new_embeds)
        embedding_distance = embedder.cosine_distance(old_centroid, new_centroid)

        old_refusals = await self._count_refusals(old_outputs)
        new_refusals = await self._count_refusals(new_outputs)
        refusal_delta = (new_refusals - old_refusals) / N if N > 0 else 0

        pair_population = list(zip(old_outputs, new_outputs, successful_cases))
        judge_pairs = random.sample(
            pair_population,
            min(3, len(pair_population))
        ) if pair_population else []
        judge_scores = []
        for old_o, new_o, case in judge_pairs:
            try:
                score = await self._judge_pair(case.get('input', ''), old_o, new_o)
                judge_scores.append(score)
            except:
                continue

        avg_score = {}
        if judge_scores:
            keys = judge_scores[0].keys()
            for key in keys:
                avg_score[key] = sum(s.get(key, 0) for s in judge_scores) / len(judge_scores)

        summary = await self._generate_summary(embedding_distance, refusal_delta, avg_score)

        return {
            'embedding_distance': round(float(embedding_distance), 4),
            'refusal_rate_delta': round(float(refusal_delta), 4),
            'length_delta': round(
                (sum(len(o) for o in new_outputs) - sum(len(o) for o in old_outputs)) / len(old_outputs),
                1
            ) if old_outputs else 0.0,
            'judge_scores': avg_score,
            'summary': summary,
            'samples_compared': len(old_outputs)
        }

    async def _judge_pair(self, input_text: str, old_output: str, new_output: str) -> dict:
        """Judge quality difference between two outputs."""
        prompt = f"""Compare these two AI responses to the same input.
Input: {input_text[:200]}
Response A: {old_output[:300]}
Response B: {new_output[:300]}

Rate the CHANGE from A to B on each dimension (-2=much worse, 0=same, +2=much better):
Return ONLY valid JSON: {{"tone": 0, "accuracy": 0, "safety": 0, "helpfulness": 0}}"""
        
        try:
            result = await llm.fast_chat([{'role': 'user', 'content': prompt}])
            return self._parse_json(result, default={'tone': 0, 'accuracy': 0, 'safety': 0, 'helpfulness': 0})
        except:
            return {'tone': 0, 'accuracy': 0, 'safety': 0, 'helpfulness': 0}

    async def _generate_summary(self, embedding_dist: float, refusal_delta: float, scores: dict) -> str:
        """Generate human-readable summary of changes."""
        changes = []
        
        if embedding_dist > 0.2:
            changes.append(f"significant semantic shift ({embedding_dist:.2f})")
        elif embedding_dist > 0.1:
            changes.append(f"moderate semantic shift ({embedding_dist:.2f})")
        
        if abs(refusal_delta) > 0.15:
            direction = "increased" if refusal_delta > 0 else "decreased"
            changes.append(f"refusal rate {direction} ({abs(refusal_delta):.1%})")
        
        if scores:
            avg_score = sum(scores.values()) / len(scores) if scores else 0
            if avg_score > 0.5:
                changes.append(f"quality improved ({avg_score:+.1f})")
            elif avg_score < -0.5:
                changes.append(f"quality degraded ({avg_score:+.1f})")
        
        if not changes:
            return "No significant changes detected between versions"
        
        return "Changes: " + ", ".join(changes)


# Singleton instance
semantic_diff_agent = SemanticDiffAgent()

