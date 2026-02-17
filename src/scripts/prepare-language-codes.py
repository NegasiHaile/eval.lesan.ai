import csv
import json

def convert_tab_file_to_JSON_CSV ():
    # Step 1: Read the .tab file
    with open("../../../../iso-639-3_Code_Tables_20250715/iso-639-3.tab", "r", encoding="utf-8") as tab_file:
        reader = csv.DictReader(tab_file, delimiter="\t")
        data = list(reader)

    # Step 2: Write to JSON
    with open("../constants/all-languages.json", "w", encoding="utf-8") as json_file:
        json.dump(data, json_file, ensure_ascii=False, indent=2)

    # Step 3: Write to CSV
    with open("../constants/all-languages.csv", "w", newline='', encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=reader.fieldnames)
        writer.writeheader()
        writer.writerows(data)


def filter_langs_with_iso1_iso3 ():
    filtered_data = []

    with open("../../../../iso-639-3_Code_Tables_20250715/iso-639-3.tab", "r", encoding="utf-8") as tab_file:
        reader = csv.DictReader(tab_file, delimiter="\t")
        
        for row in reader:
            # Only include rows that have non-empty Part1, Part2b, and Ref_Name
            if row["Part1"] and row["Part2b"] and row["Ref_Name"]:
                filtered_data.append({
                    "iso_name": row["Ref_Name"],
                    # "iso_639_id": row["Id"],
                    "iso_639_1": row["Part1"],
                    "iso_639_3": row["Part2b"],
                })

    # Write filtered data to JSON
    with open("../constants/iso1-iso3-languages.json", "w", encoding="utf-8") as json_file:
        json.dump(filtered_data, json_file, ensure_ascii=False, indent=2)

    # Write filtered data to CSV
    with open("../constants/iso1-iso3-languages.csv", "w", newline='', encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=['iso_name', 'iso_639_1', 'iso_639_3'])
        writer.writeheader()
        writer.writerows(filtered_data)

    
    print(F"-----------{len(filtered_data)} LANGUAGES FILTERED!-----------")


# convert_tab_file_to_JSON_CSV()
filter_langs_with_iso1_iso3()

