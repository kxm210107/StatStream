from sqlalchemy import Column, Integer, String, Float
from database import Base

class PlayerStat(Base):
    __tablename__ = "player_stats"

    # Composite primary key: same player can appear in multiple seasons
    player_id    = Column(Integer, primary_key=True)
    season       = Column(String,  primary_key=True)   # e.g. "2024-25"

    player_name  = Column(String)
    team         = Column(String)
    pts_per_game = Column(Float)
    reb_per_game = Column(Float)
    ast_per_game = Column(Float)
