
import torch
from transformers import BertTokenizer, BertModel

MODEL_NAME = "google-bert/bert-base-cased"

def test_bert():

    print("\n================================")
    print("       MNM BERT SYSTEM TEST")
    print("================================")

    try:
        print("\nLoading BERT model...")

        device = torch.device(
            "mps" if torch.backends.mps.is_available()
            else "cpu"
        )

        tokenizer = BertTokenizer.from_pretrained(MODEL_NAME)
        model = BertModel.from_pretrained(MODEL_NAME)

        model.to(device)
        model.eval()

        test_text = "Water is leaking from my bathroom pipe"

        inputs = tokenizer(
            test_text,
            return_tensors="pt"
        )

        inputs = {
            key: value.to(device)
            for key, value in inputs.items()
        }

        with torch.no_grad():
            outputs = model(**inputs)

        print("\nBERT MODEL STATUS : WORKING")
        print("Tokenizer         : Working")
        print("Text processing   : Working")
        print("Model output      : Working")
        print(f"Device            : {device}")
        print(f"Output shape      : {outputs.last_hidden_state.shape}")

        print("\n================================")
        print("       ALL TESTS PASSED")
        print("================================")

    except Exception as error:

        print("\nBERT MODEL STATUS : NOT WORKING")
        print(f"Error: {error}")


if __name__ == "__main__":
    test_bert()
