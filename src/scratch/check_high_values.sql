SELECT id, "userId", "data"->>'totalEstimatedValue' as value
FROM "Activity"
WHERE type = 'MINING'
AND ("data"->>'totalEstimatedValue')::float > 1000000000;
