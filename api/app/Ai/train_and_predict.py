import sys
import os
import joblib
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline
import json

CONFIDENCE_THRESHOLD = 0.2
MODEL_FOLDER = '/var/www/html/storage/app/ai/models'
MODEL_NAME = 'category_predictor.pkl'

def train_model_from_json(json_data):
    try:
        data = json.loads(json_data)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        sys.exit(1)
    
    if not os.path.exists(MODEL_FOLDER):
        os.makedirs(MODEL_FOLDER)

    names = [item['name'] for item in data]
    categories = [item['category_id'] for item in data]
    
    model = make_pipeline(CountVectorizer(), MultinomialNB())
    model.fit(names, categories)
    joblib.dump(model, MODEL_FOLDER + "/" + MODEL_NAME)
    print("Model trained and saved successfully.")

def predict_category(json_data):
    try:
        data = json.loads(json_data)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        sys.exit(1)

    try:
        model = joblib.load(MODEL_FOLDER + "/" + MODEL_NAME)
    except FileNotFoundError as e:
        print(f"Model file not found: {e}")
        sys.exit(1)

    items = [item['name'] for item in data]
    probabilities = model.predict_proba(items)

    predicted_categories = model.classes_[probabilities.argmax(axis=1)]
    max_probabilities = probabilities.max(axis=1)

    highest_prob_category = None
    highest_prob = 0
    for category, prob in zip(predicted_categories, max_probabilities):
        if prob >= CONFIDENCE_THRESHOLD and prob > highest_prob:
            highest_prob = prob
            highest_prob_category = category

    return highest_prob_category if highest_prob_category is not None else ''

if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == 'train':
        data = sys.argv[2]
        train_model_from_json(data)
    elif len(sys.argv) == 3 and sys.argv[1] == 'predict':
        data = sys.argv[2]
        categories = predict_category(data)
        print(categories)
    else:
        print("Invalid arguments")
        sys.exit(1)
