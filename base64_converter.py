"""
Base64 JPG/PNG Converter
Converts images from a folder to base64 format for pattern definitions.
"""

import base64
import os

# Define the image files and their corresponding pattern info
image_mappings = [
    {
        "path": r"C:\Users\sebas\Desktop\Figure\Top_Left.png",
        "id": "pattern-17",
        "name": "Top-Left Empty"
    },
    {
        "path": r"C:\Users\sebas\Desktop\Figure\Top-right.png",
        "id": "pattern-18",
        "name": "Top-Right Empty"
    },
    {
        "path": r"C:\Users\sebas\Desktop\Figure\Bottom Left.png",
        "id": "pattern-19",
        "name": "Bottom-Left Empty"
    },
    {
        "path": r"C:\Users\sebas\Desktop\Figure\Bottom Right.png",
        "id": "pattern-20",
        "name": "Bottom-Right Empty"
    },
    {
        "path": r"C:\Users\sebas\Desktop\Figure\Horizontal.png",
        "id": "pattern-21",
        "name": "Horizontal Empty"
    },
    {
        "path": r"C:\Users\sebas\Desktop\Figure\Vertical.png",
        "id": "pattern-22",
        "name": "Vertical Empty"
    }
]

def image_to_base64(image_path):
    """Convert an image file to base64 string."""
    try:
        with open(image_path, "rb") as image_file:
            # Read the image data
            image_data = image_file.read()
            # Encode to base64
            base64_encoded = base64.b64encode(image_data).decode('utf-8')
            
            # Determine the MIME type based on file extension
            ext = os.path.splitext(image_path)[1].lower()
            if ext == '.png':
                mime_type = 'image/png'
            elif ext in ['.jpg', '.jpeg']:
                mime_type = 'image/jpeg'
            elif ext == '.gif':
                mime_type = 'image/gif'
            else:
                mime_type = 'image/png'  # Default to PNG
            
            return f"data:{mime_type};base64,{base64_encoded}"
    except FileNotFoundError:
        print(f"Warning: File not found - {image_path}")
        return ""
    except Exception as e:
        print(f"Error processing {image_path}: {e}")
        return ""

def main():
    print("Converting images to base64 pattern definitions...\n")
    print("-" * 50)
    
    results = []
    for mapping in image_mappings:
        base64_data = image_to_base64(mapping["path"])
        result = f"    {{ id: '{mapping['id']}', name: '{mapping['name']}', type: 'pattern', base64: '{base64_data}' }},"
        results.append(result)
        print(f"Processed: {mapping['name']}")
    
    print("-" * 50)
    print("\nOutput:\n")
    for result in results:
        print(result)
    
    # Also save to a file
    output_file = "patterns_output.txt"
    with open(output_file, "w", encoding="utf-8") as f:
        for result in results:
            f.write(result + "\n")
    print(f"\nResults saved to: {output_file}")

if __name__ == "__main__":
    main()
