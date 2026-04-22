import pandas as pd

POP_PATH = "data/raw/population_neighborhood.csv"
BIZ_PATH = "data/raw/business_neighborhood.csv"


def read_csv_with_fallback(path, encodings=None, **read_kwargs):
    if encodings is None:
        encodings = ["utf-8-sig", "utf-8", "cp949", "euc-kr"]
    read_kwargs.setdefault("index_col", False)

    last_error = None
    for encoding in encodings:
        try:
            return pd.read_csv(path, encoding=encoding, **read_kwargs)
        except UnicodeDecodeError as error:
            last_error = error

    raise UnicodeDecodeError(
        last_error.encoding,
        last_error.object,
        last_error.start,
        last_error.end,
        f"Failed to decode {path}. Tried encodings: {encodings}",
    )


def process_population():
    df = read_csv_with_fallback(POP_PATH)

    # Support both legacy and current schemas.
    df = df.rename(columns={
        "행정동명": "neighborhood",
        "자치구": "district",
        "시간대구분": "hour",
        "총생활인구수": "population",
        "시각": "hour",
        "생활인구합계": "population",
        "행정동코드": "neighborhood_code",
    })

    if "district" not in df.columns and "neighborhood_code" in df.columns:
        code_str = df["neighborhood_code"].astype(str).str.replace(r"\.0$", "", regex=True)
        df["district"] = code_str.str[:5]
        df["neighborhood"] = code_str

    df["hour"] = pd.to_numeric(df["hour"], errors="coerce")
    pop_str = (
        df["population"]
        .astype(str)
        .str.replace(",", "", regex=False)
        .replace({"*": None, r"\\N": None})
    )
    df["population"] = pd.to_numeric(pop_str, errors="coerce")
    df = df.dropna(subset=["district", "neighborhood", "hour", "population"])

    # Day
    day = df[df["hour"].between(9, 18)].groupby(
        ["district", "neighborhood"]
    )["population"].mean().reset_index(name="day_pop")

    # Night
    night = df[df["hour"].between(19, 23)].groupby(
        ["district", "neighborhood"]
    )["population"].mean().reset_index(name="night_pop")

    merged = pd.merge(day, night, on=["district", "neighborhood"])
    merged["night_ratio"] = merged["night_pop"] / merged["day_pop"]

    return merged


def process_business():
    df = read_csv_with_fallback(BIZ_PATH)

    # The first two rows in this file are category headers and units.
    header_row = df.iloc[0]
    unit_row = df.iloc[1]
    data = df.iloc[2:].copy()

    data = data.rename(columns={
        "동별(2)": "district",
        "동별(3)": "neighborhood",
    })
    data = data[
        (data["district"] != "소계")
        & (data["district"] != "합계")
        & (data["neighborhood"] != "소계")
    ].copy()

    data["district"] = data["district"].astype(str).str.strip()
    data["neighborhood"] = data["neighborhood"].astype(str).str.strip()

    category_cols = []
    for col in df.columns[3:]:
        category_name = str(header_row[col]).strip()
        unit_name = str(unit_row[col]).strip()
        if unit_name == "사업체수 (개)":
            category_cols.append((col, category_name))

    out = data[["district", "neighborhood"]].copy()
    for col, category_name in category_cols:
        category_simple = "other"
        if "카페" in category_name or "커피" in category_name:
            category_simple = "cafe"
        elif "술" in category_name or "주점" in category_name:
            category_simple = "bar"
        elif "음식" in category_name or "식당" in category_name:
            category_simple = "restaurant"

        value = pd.to_numeric(data[col], errors="coerce").fillna(0)
        if category_simple in out.columns:
            out[category_simple] += value
        else:
            out[category_simple] = value

    for col in ["cafe", "restaurant", "bar"]:
        if col not in out.columns:
            out[col] = 0
    out["total_business"] = out[["cafe", "restaurant", "bar", "other"]].sum(axis=1)

    return out

def merge_all():
    pop_df = process_population()
    biz_df = process_business()

    df = pd.merge(
        pop_df,
        biz_df,
        on=["district", "neighborhood"],
        how="left"
    )

    for col in ["cafe", "restaurant", "bar"]:
        if col not in df.columns:
            df[col] = 0

    df[["cafe", "restaurant", "bar"]] = df[
        ["cafe", "restaurant", "bar"]
    ].fillna(0)

    return df

def add_vibe_score(df):
    df["cafe_norm"] = df["cafe"] / df["cafe"].max()
    df["bar_norm"] = df["bar"] / df["bar"].max()
    df["night_norm"] = df["night_ratio"] / df["night_ratio"].max()

    df["vibe_score"] = (
        0.4 * df["night_norm"] +
        0.3 * df["cafe_norm"] +
        0.3 * df["bar_norm"]
    )

    return df

def main():
    df = merge_all()
    df = add_vibe_score(df)

    df.to_csv("data/neighborhoods_processed.csv", index=False)

    print("✅ Saved neighborhoods_processed.csv")


if __name__ == "__main__":
    main()