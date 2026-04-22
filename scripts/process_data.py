import pandas as pd

# =========================
# 1. FILE PATHS
# =========================
POP_PATH = "data/raw/population.csv"
BIZ_PATH = "data/raw/business.csv"
DEMO_PATH = "data/raw/demographics.csv"

OUTPUT_PATH = "data/processed_neighborhoods.csv"


def read_csv_with_fallback(path, encodings=None, **read_kwargs):
    """Read CSV with encoding fallbacks for mixed-source files."""
    if encodings is None:
        encodings = ["utf-8-sig", "utf-8", "cp949", "euc-kr"]

    last_error = None
    for encoding in encodings:
        try:
            df = pd.read_csv(path, encoding=encoding, **read_kwargs)
            print(f"Loaded {path} with encoding={encoding}")
            return df
        except UnicodeDecodeError as error:
            last_error = error
            continue

    raise UnicodeDecodeError(
        last_error.encoding,
        last_error.object,
        last_error.start,
        last_error.end,
        f"Failed to decode {path}. Tried encodings: {encodings}",
    )


# =========================
# District code mappings
# =========================

# Population uses 통계청 행정구역코드 (census H_CODE)
POP_CODE_MAP = {
    11110: "종로구", 11140: "중구",    11170: "용산구", 11200: "성동구",
    11215: "광진구", 11230: "동대문구", 11260: "중랑구", 11290: "성북구",
    11305: "강북구", 11320: "도봉구",  11350: "노원구", 11380: "은평구",
    11410: "서대문구", 11440: "마포구", 11470: "양천구", 11500: "강서구",
    11530: "구로구", 11545: "금천구",  11560: "영등포구", 11590: "동작구",
    11620: "관악구", 11650: "서초구",  11680: "강남구", 11710: "송파구",
    11740: "강동구",
}

# Business uses 법정동 코드 (legal-dong code, first 5 digits)
BIZ_CODE_MAP = {
    "11010": "종로구", "11020": "중구",    "11030": "용산구", "11040": "성동구",
    "11050": "광진구", "11060": "동대문구", "11070": "중랑구", "11080": "성북구",
    "11090": "강북구", "11100": "도봉구",  "11110": "노원구", "11120": "은평구",
    "11130": "서대문구", "11140": "마포구", "11150": "양천구", "11160": "강서구",
    "11170": "구로구", "11180": "금천구",  "11190": "영등포구", "11200": "동작구",
    "11210": "관악구", "11220": "서초구",  "11230": "강남구", "11240": "송파구",
    "11250": "강동구",
}


# =========================
# 2. LOAD DATA
# =========================
def load_data():
    pop = read_csv_with_fallback(POP_PATH)
    biz = read_csv_with_fallback(BIZ_PATH)
    return pop, biz


# =========================
# 3. PROCESS POPULATION
# =========================
def process_population(pop):
    pop = pop.rename(columns={
        "adstrd_code_se": "code",
        "tmzon_pd_se": "time",
        "tot_lvpop_co": "population",
    })

    pop["district"] = pop["code"].map(POP_CODE_MAP)
    pop = pop.dropna(subset=["district"])
    pop["time"] = pd.to_numeric(pop["time"], errors="coerce")
    pop["population"] = pd.to_numeric(pop["population"], errors="coerce")

    # Day vs Night split
    day = pop[pop["time"].between(9, 18)].groupby("district")["population"].mean()
    night = pop[pop["time"].between(19, 23)].groupby("district")["population"].mean()

    # Young ratio from age columns (20–39)
    age_cols_20_39 = [c for c in pop.columns if any(
        tag in c for tag in ["f20t", "f25t", "f30t", "f35t"]
    )]
    pop[age_cols_20_39] = pop[age_cols_20_39].apply(pd.to_numeric, errors="coerce")
    pop["young_pop"] = pop[age_cols_20_39].sum(axis=1)

    young = pop.groupby("district").agg(
        young_pop=("young_pop", "mean"),
        total_pop=("population", "mean"),
    )
    young["young_ratio"] = young["young_pop"] / young["total_pop"]

    pop_df = pd.DataFrame({
        "district": day.index,
        "day_pop": day.values,
        "night_pop": night.reindex(day.index).values,
    }).merge(young[["young_ratio"]], on="district", how="left")

    return pop_df


# =========================
# 4. PROCESS BUSINESS
# =========================
def process_business(biz):
    biz["district"] = biz["AD_CD"].astype(str).str[:5].map(BIZ_CODE_MAP)
    biz = biz.dropna(subset=["district"])

    # KSIC codes: 5622x = cafes/coffee, 5621x = bars/pubs
    code = biz["MBZ_INDST_DIV_CD"].astype(str)
    biz["is_cafe"] = code.str.startswith("5622")
    biz["is_bar"] = code.str.startswith("5621")

    grouped = biz.groupby("district").agg(
        is_cafe=("is_cafe", "sum"),
        is_bar=("is_bar", "sum"),
    ).reset_index()

    total = biz.groupby("district").size().reset_index(name="total_business")
    biz_df = grouped.merge(total, on="district")

    return biz_df


# =========================
# 5. MERGE & VIBE SCORES
# =========================
def merge_and_score(pop_df, biz_df):
    df = pop_df.merge(biz_df, on="district", how="inner")

    df["night_ratio"] = df["night_pop"] / df["day_pop"]
    df["vibe_nightlife"] = df["night_ratio"]
    df["vibe_chill"] = df["is_cafe"] / df["total_business"]
    df["vibe_trendy"] = df["young_ratio"]

    # Normalize all vibe scores to [0, 1]
    for col in ["vibe_nightlife", "vibe_chill", "vibe_trendy"]:
        mn, mx = df[col].min(), df[col].max()
        df[col] = (df[col] - mn) / (mx - mn) if mx > mn else 0.5

    cols = ["district", "day_pop", "night_pop", "is_cafe", "is_bar",
            "total_business", "young_ratio", "night_ratio",
            "vibe_nightlife", "vibe_chill", "vibe_trendy"]
    return df[cols]


# =========================
# MAIN
# =========================
def main():
    pop, biz = load_data()

    pop_df = process_population(pop)
    biz_df = process_business(biz)

    df = merge_and_score(pop_df, biz_df)

    print(df.head())
    print(f"\nTotal districts: {len(df)}")
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
